const PROGRAMMING_ONLY_MESSAGE = '프로그래밍과 관련된 질문만 할 수 있어요. 엔트리 블록, 코드, 오류, 알고리즘에 대해 질문해 주세요.'

const systemInstruction = `당신은 한국 중학생의 블록 프로그래밍 학습을 돕는 튜터입니다.
반드시 다른 문장이나 마크다운 없이 {"isProgramming":true 또는 false,"answer":"답변"} 형식의 JSON 하나만 출력하세요.
사용자의 질문이 프로그래밍, 코딩, 컴퓨터 과학, 알고리즘, 엔트리/스크래치 블록, 프로그램 오류 해결과 직접 관련되는지 먼저 판단하세요.
관련이 없으면 isProgramming을 false로 하고 answer는 비워 두세요.
관련이 있으면 isProgramming을 true로 하고 다음 원칙에 따라 한국어로 답하세요.
- 학생이 스스로 해결할 수 있도록 개념, 생각 순서, 확인 방법을 쉽고 구체적으로 설명합니다.
- 과제의 완성 코드나 정답 파일을 그대로 제공하지 않습니다.
- 첨부 이미지가 있으면 이미지에 보이는 블록이나 오류를 근거로 설명합니다. 보이지 않는 내용은 추측하지 않습니다.
- 짧은 예시는 허용하되 학생 과제의 정답 전체를 대신 만들지 않습니다.
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
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!apiKey) return res.status(503).json({ error: '질문 서버의 환경 변수가 적용되지 않았습니다. GEMINI_API_KEY를 Production 환경에 저장한 뒤 다시 배포해 주세요.' })

  const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 3000) : ''
  const image = parseDataUrl(req.body?.image)
  if (!message && !image) return res.status(400).json({ error: '질문을 입력해 주세요.' })
  if (req.body?.image && !image) return res.status(400).json({ error: '지원하지 않는 이미지 형식입니다.' })
  if (image && image.data.length > 2.8 * 1024 * 1024) return res.status(413).json({ error: '이미지 용량이 너무 큽니다.' })

  const assignment = req.body?.assignment || {}
  const context = [
    assignment.title && `과제 제목: ${String(assignment.title).slice(0, 200)}`,
    assignment.description && `교사의 과제 설명: ${String(assignment.description).slice(0, 1500)}`,
    assignment.hint && `교사의 힌트: ${String(assignment.hint).slice(0, 700)}`,
    `학생 질문: ${message || '첨부한 프로그래밍 화면을 설명해 주세요.'}`
  ].filter(Boolean).join('\n')

  const parts = [{ text: context }]
  if (image) parts.push({ inlineData: image })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 25000)

  try {
    const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash'
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 900
        }
      })
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data?.error?.message || '답변 생성에 실패했습니다.')
    const text = data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('')
    if (!text) throw new Error('답변을 받지 못했습니다.')
    const result = extractJson(text)
    if (!result.isProgramming) return res.status(200).json({ allowed: false, answer: PROGRAMMING_ONLY_MESSAGE })
    return res.status(200).json({ allowed: true, answer: String(result.answer || '').trim() || '질문을 조금 더 자세히 적어 주세요.' })
  } catch (error) {
    console.error('Gemini request failed:', error?.message || error)
    const message = error?.name === 'AbortError' ? '답변 시간이 오래 걸리고 있습니다. 잠시 후 다시 질문해 주세요.' : '답변을 만드는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
    return res.status(502).json({ error: message })
  } finally {
    clearTimeout(timer)
  }
}
