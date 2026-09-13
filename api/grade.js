const systemInstruction = `당신은 한국 중학생의 엔트리(블록 코딩) 과제를 채점하는 채점자입니다.
반드시 다른 문장이나 마크다운 없이 {"correct":true 또는 false,"feedback":"평가 코멘트"} 형식의 JSON 하나만 출력하세요.
"학생 프로젝트 코드"는 엔트리 프로젝트 파일(project.json)의 내용으로, 오브젝트·변수·블록 스크립트 정보를 담고 있습니다.
"정답 기준"에서 요구하는 동작이 블록 스크립트에 실제로 구현되어 있는지 분석해서 만족하면 correct를 true로, 만족하지 않으면 false로 판단하세요.
정답 기준에서 언급하지 않은 사소한 차이(오브젝트 이름, 배경, 변수 이름, 메시지 문구 등)는 감점하지 마세요.
증가·조건 검사처럼 같은 반복 안에 있는 블록들의 순서를 정답과 다르게 배치해도 전체적인 반복 구조와 의도한 결과가 같다면(예: 매초 값이 증가하고 특정 값을 넘으면 초기화되는 로직), 초기화 시점이 한 틱 정도 어긋나는 등의 사소한 차이는 감점하지 말고 correct로 판단하세요. 반복·조건 구조 자체가 빠졌거나 정답 기준이 요구하는 결과와 근본적으로 다르게 동작하는 경우에만 false로 판단하세요.
feedback은 한국어로 2~4문장, 학생이 이해할 수 있게 구체적으로 무엇을 잘했는지 또는 무엇을 고쳐야 하는지 설명하세요.
correct가 false일 때도 정답 코드를 그대로 알려주지 말고 확인해야 할 부분에 대한 힌트만 주세요.`

function extractJson(text) {
  try { return JSON.parse(text) } catch {}
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('채점 결과 형식을 확인할 수 없습니다.')
  return JSON.parse(match[0])
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: '허용되지 않은 요청입니다.' })
  const rawApiKey = process.env.OPENAI_API_KEY
  const apiKey = rawApiKey?.trim().replace(/^['"]|['"]$/g, '')
  if (!apiKey) return res.status(503).json({ error: '채점 서버의 환경 변수가 적용되지 않았습니다. OPENAI_API_KEY를 Production 환경에 저장한 뒤 다시 배포해 주세요.' })

  const criteria = typeof req.body?.criteria === 'string' ? req.body.criteria.trim().slice(0, 2000) : ''
  const project = typeof req.body?.project === 'string' ? req.body.project.slice(0, 20000) : ''
  if (!criteria) return res.status(400).json({ error: '교사가 정답 기준을 설정하지 않은 과제입니다. 교사에게 문의해 주세요.' })
  if (!project) return res.status(400).json({ error: '제출한 파일에서 프로젝트 내용을 확인할 수 없습니다.' })

  const title = typeof req.body?.title === 'string' ? req.body.title.slice(0, 200) : ''
  const description = typeof req.body?.description === 'string' ? req.body.description.slice(0, 1500) : ''
  const context = [
    title && `과제 제목: ${title}`,
    description && `과제 설명: ${description}`,
    `정답 기준: ${criteria}`,
    `학생 프로젝트 코드(project.json): ${project}`,
  ].filter(Boolean).join('\n\n')

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
        temperature: 0,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: context }
        ]
      })
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data?.error?.message || '채점에 실패했습니다.')
    const text = data?.choices?.[0]?.message?.content
    if (!text) throw new Error('채점 결과를 받지 못했습니다.')
    const result = extractJson(text)
    const correct = !!result.correct
    return res.status(200).json({ correct, feedback: String(result.feedback || '').trim() || (correct ? '정답이에요!' : '다시 한번 확인해 보세요.') })
  } catch (error) {
    console.error('OpenAI grading failed:', error?.message || error)
    const message = error?.name === 'AbortError'
      ? '채점 시간이 오래 걸리고 있습니다. 잠시 후 다시 시도해 주세요.'
      : error?.message ? `채점 중 오류가 발생했습니다: ${error.message}` : '채점 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
    return res.status(502).json({ error: message })
  } finally {
    clearTimeout(timer)
  }
}
