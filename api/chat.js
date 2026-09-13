const PROGRAMMING_ONLY_MESSAGE = '코딩 수업과 과제에 관련된 질문만 할 수 있어요. 엔트리 블록, 코드, 오류, 과제 내용에 대해 질문해 주세요.'

const systemInstruction = `당신은 한국 중학생의 코딩 수업과 과제 해결을 돕는 튜터입니다.
반드시 다른 문장이나 마크다운 없이 {"isProgramming":true 또는 false,"answer":"답변"} 형식의 JSON 하나만 출력하세요.
프로그래밍뿐 아니라 현재 과제, 코딩 수업, 학습 방법, 직전 답변의 요약·재설명·문장 정리 같은 후속 요청도 수업 관련 질문으로 판단하세요.
현재 대화와 수업 맥락에서 완전히 벗어난 일상 질문(예: 현재 시각, 졸리다, 음식 추천)만 isProgramming을 false로 하고 answer는 비워 두세요.
수업 관련 질문이면 isProgramming을 true로 하고 다음 원칙에 따라 한국어로 답하세요.
- 학생이 스스로 해결할 수 있도록 개념, 생각 순서, 확인 방법을 쉽고 구체적으로 설명합니다.
- 과제의 완성 코드나 정답 파일을 그대로 제공하지 않습니다.
- 첨부 이미지가 있으면 이미지에 보이는 블록이나 오류를 근거로 설명합니다. 보이지 않는 내용은 추측하지 않습니다.
- 짧은 예시는 허용하되 학생 과제의 정답 전체를 대신 만들지 않습니다.
- 토큰을 아끼기 위해 2~3문장 이내로 최대한 짧게 답합니다. 긴 설명이나 여러 문단으로 나누지 않습니다.
- 별표, 샵, 표 같은 마크다운 문법을 사용하지 말고 일반 문장과 줄바꿈만 사용합니다.
- 위험하거나 부적절한 컴퓨터 사용법은 안내하지 않습니다.`

function parseDataUrl(value) {
  if (!value) return null
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value)
  if (!match) return null
  return { mimeType: match[1], data: match[2] }
}

function extractJson(text) {
  try { return JSON.parse(text) } catch {}
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('응답 형식을 확인할 수 없습니다.')
  return JSON.parse(match[0])
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: '허용되지 않은 요청입니다.' })
  const rawApiKey = process.env.OPENAI_API_KEY
  const apiKey = rawApiKey?.trim().replace(/^['"]|['"]$/g, '')
  if (!apiKey) return res.status(503).json({ error: '질문 서버의 환경 변수가 적용되지 않았습니다. OPENAI_API_KEY를 Production 환경에 저장한 뒤 다시 배포해 주세요.' })

  const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 3000) : ''
  const image = parseDataUrl(req.body?.image)
  if (!message && !image) return res.status(400).json({ error: '질문을 입력해 주세요.' })
  if (req.body?.image && !image) return res.status(400).json({ error: '지원하지 않는 이미지 형식입니다.' })
  if (image && image.data.length > 2.8 * 1024 * 1024) return res.status(413).json({ error: '이미지 용량이 너무 큽니다.' })

  const assignment = req.body?.assignment || {}
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-6) : []
  const recentConversation = history.map(item => {
    const speaker = item?.role === 'user' ? '학생' : '길잡이'
    return `${speaker}: ${String(item?.text || '').slice(0, 1200)}`
  }).filter(line => !line.endsWith(': ')).join('\n')
  const context = [
    assignment.title && `과제 제목: ${String(assignment.title).slice(0, 200)}`,
    assignment.description && `교사의 과제 설명: ${String(assignment.description).slice(0, 1500)}`,
    assignment.hint && `교사의 힌트: ${String(assignment.hint).slice(0, 700)}`,
    recentConversation && `최근 대화:\n${recentConversation}`,
    `학생 질문: ${message || '첨부한 프로그래밍 화면을 설명해 주세요.'}`
  ].filter(Boolean).join('\n')

  const userContent = image
    ? [{ type: 'text', text: context }, { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.data}` } }]
    : context

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 25000)

  try {
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: 300,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userContent }
        ]
      })
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data?.error?.message || '답변 생성에 실패했습니다.')
    const text = data?.choices?.[0]?.message?.content
    if (!text) throw new Error('답변을 받지 못했습니다.')
    const result = extractJson(text)
    if (!result.isProgramming) return res.status(200).json({ allowed: false, answer: PROGRAMMING_ONLY_MESSAGE })
    return res.status(200).json({ allowed: true, answer: String(result.answer || '').trim() || '질문을 조금 더 자세히 적어 주세요.' })
  } catch (error) {
    console.error('OpenAI request failed:', error?.message || error)
    const message = error?.name === 'AbortError'
      ? '답변 시간이 오래 걸리고 있습니다. 잠시 후 다시 질문해 주세요.'
      : error?.message ? `답변을 만드는 중 오류가 발생했습니다: ${error.message}` : '답변을 만드는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
    return res.status(502).json({ error: message })
  } finally {
    clearTimeout(timer)
  }
}
