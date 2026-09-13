import { useMemo, useState } from 'react'
import {
  ArrowLeft, ArrowRight, BarChart3, BookOpen, Check, CheckCircle2,
  ChevronDown, CircleUserRound, ClipboardCheck, Clock3, Code2, Crown,
  FilePlus2, FileCode2, LayoutDashboard, Lightbulb, LogOut, Menu, MessageCircle,
  MoreHorizontal, PencilLine, Plus, Search, Send, ShieldCheck, Sparkles,
  Upload, UserCog, Users, X, XCircle,
} from 'lucide-react'

const USERS = {
  student: { name: '김민준', role: '학생', className: '2학년 3반' },
  teacher: { name: '이서연', role: '교사', className: '정보 교과' },
  admin: { name: '박지훈', role: '관리자', className: '시스템 관리' },
}

const INITIAL_TASKS = [
  {
    id: 1, title: '미로를 탈출하는 고양이', subject: '반복 구조', due: '9월 18일',
    description: '고양이가 벽에 닿지 않고 깃발까지 이동하도록 블록을 조합해 보세요.',
    hint: '같은 움직임이 몇 번 반복되는지 먼저 찾아보세요.', status: 'progress', attempts: 1,
  },
  {
    id: 2, title: '점수 계산기 만들기', subject: '변수와 연산', due: '9월 22일',
    description: '정답을 맞힐 때마다 점수가 10점씩 올라가는 프로그램을 만들어 보세요.',
    hint: '점수를 저장할 상자 하나가 필요해요.', status: 'todo', attempts: 0,
  },
  {
    id: 3, title: '우주선 장애물 피하기', subject: '조건문', due: '9월 12일',
    description: '방향키로 우주선을 움직이고 장애물에 닿으면 게임이 끝나도록 만들어 보세요.',
    hint: '장애물에 닿았는지를 계속 확인해야 해요.', status: 'done', attempts: 2,
  },
]

const CLASS_ROWS = [
  ['김민준', '2301', '제출', '정답', '오늘 10:24'], ['박서윤', '2302', '제출', '확인 필요', '오늘 09:51'],
  ['최도윤', '2303', '미제출', '-', '-'], ['정하은', '2304', '제출', '정답', '어제 16:42'],
  ['윤지호', '2305', '제출', '오답', '어제 15:18'], ['한예린', '2306', '미제출', '-', '-'],
]

function App() {
  const [userType, setUserType] = useState(null)
  const [active, setActive] = useState('홈')
  const [mobileNav, setMobileNav] = useState(false)
  const [tasks, setTasks] = useState(INITIAL_TASKS)
  const [selectedTask, setSelectedTask] = useState(null)

  if (!userType) return <Login onLogin={setUserType} />

  const user = USERS[userType]
  const navigation = userType === 'student'
    ? [['홈', LayoutDashboard], ['내 과제', BookOpen], ['질문 기록', MessageCircle]]
    : userType === 'teacher'
      ? [['대시보드', LayoutDashboard], ['과제 관리', ClipboardCheck], ['학생 현황', Users]]
      : [['관리', LayoutDashboard], ['교사 관리', UserCog], ['권한 설정', ShieldCheck]]

  const page = userType === 'student'
    ? (selectedTask ? <TaskWorkspace task={selectedTask} onBack={() => setSelectedTask(null)} onUpdate={(patch) => setTasks(t => t.map(x => x.id === selectedTask.id ? {...x, ...patch} : x))} /> : <StudentHome tasks={tasks} onSelect={setSelectedTask} active={active} onNavigate={setActive} />)
    : userType === 'teacher' ? <TeacherPage active={active} onNavigate={setActive} /> : <AdminPage active={active} />

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="brand"><Logo /><span>생각코딩</span><button className="mobile-close" onClick={() => setMobileNav(false)}><X size={20}/></button></div>
        <nav>
          {navigation.map(([label, Icon]) => <button key={label} className={active === label ? 'active' : ''} onClick={() => { setActive(label); setSelectedTask(null); setMobileNav(false) }}><Icon size={19}/><span>{label}</span></button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-mini"><div className="avatar">{user.name[0]}</div><div><b>{user.name}</b><span>{user.className}</span></div><MoreHorizontal size={18}/></div>
          <button className="logout" onClick={() => setUserType(null)}><LogOut size={18}/>로그아웃</button>
        </div>
      </aside>
      {mobileNav && <div className="nav-overlay" onClick={() => setMobileNav(false)} />}
      <main className="main">
        <header className="topbar"><button className="menu-btn" onClick={() => setMobileNav(true)}><Menu/></button><div className="mobile-brand"><Logo/><b>생각코딩</b></div><div className="role-pill">{user.role}</div></header>
        {page}
      </main>
    </div>
  )
}

function Logo() { return <div className="logo"><Code2 size={20}/></div> }

function Login({ onLogin }) {
  const [role, setRole] = useState('student')
  const [showPw, setShowPw] = useState(false)
  return <div className="login-page">
    <section className="login-intro">
      <div className="login-brand"><Logo/><span>생각코딩</span></div>
      <div className="intro-copy"><p className="eyebrow">생각하고, 질문하고, 해결하는</p><h1>코딩을 배우는<br/>새로운 방식.</h1><p>정답을 외우기보다 해결하는 힘을 키워요.<br/>한 단계씩, 내 생각으로 완성해 보세요.</p></div>
      <div className="shape shape-a"></div><div className="shape shape-b"></div><div className="dot-grid"></div>
      <p className="copyright">© 2026 생각코딩 · 성재중학교</p>
    </section>
    <section className="login-panel">
      <form className="login-card" onSubmit={(e) => { e.preventDefault(); onLogin(role) }}>
        <div><p className="eyebrow">반가워요!</p><h2>로그인</h2><p className="muted">수업을 계속하려면 계정으로 로그인하세요.</p></div>
        <div className="role-tabs">
          {[['student','학생'],['teacher','교사'],['admin','관리자']].map(([key,label]) => <button type="button" key={key} className={role === key ? 'selected' : ''} onClick={() => setRole(key)}>{label}</button>)}
        </div>
        <label>아이디<input defaultValue={role === 'student' ? 'student2301' : role === 'teacher' ? 'teacher01' : 'admin'} key={role} /></label>
        <label>비밀번호<div className="password"><input type={showPw ? 'text' : 'password'} defaultValue="12345678"/><button type="button" onClick={() => setShowPw(!showPw)}>{showPw ? '숨김' : '보기'}</button></div></label>
        <div className="login-options"><label><input type="checkbox" defaultChecked/> 로그인 유지</label><button type="button" onClick={()=>alert('담당 교사 또는 학교 관리자에게 비밀번호 초기화를 요청해 주세요.')}>비밀번호 찾기</button></div>
        <button className="primary big" type="submit">로그인 <ArrowRight size={18}/></button>
        <p className="demo-note">역할을 선택해 각 화면을 체험할 수 있어요.</p>
      </form>
    </section>
  </div>
}

function StudentHome({ tasks, onSelect, active, onNavigate }) {
  const done = tasks.filter(t => t.status === 'done').length
  return <div className="page-wrap">
    <div className="page-heading"><div><p className="eyebrow">9월 13일 일요일</p><h1>{active === '질문 기록' ? '질문 기록' : active === '내 과제' ? '내 과제' : '안녕하세요, 민준님!'}</h1><p>{active === '질문 기록' ? '과제를 해결하며 나눈 질문을 다시 살펴보세요.' : '오늘도 차근차근 문제를 해결해 볼까요?'}</p></div></div>
    {active === '질문 기록' ? <QuestionHistory /> : <>
      {active === '홈' && <div className="student-summary">
        <div className="summary-main"><div className="summary-icon"><BookOpen/></div><div><span>이번 달 학습</span><strong>{done}<small> / {tasks.length}개 완료</small></strong></div><div className="progress"><i style={{width:`${done/tasks.length*100}%`}}></i></div></div>
        <div className="stat"><span>해결한 과제</span><b>{done}</b><em>개</em></div><div className="stat"><span>남은 과제</span><b>{tasks.length-done}</b><em>개</em></div>
      </div>}
      <div className="section-title"><div><h2>{active === '내 과제' ? '전체 과제' : '진행 중인 과제'}</h2><p>{active === '내 과제' ? `${tasks.length}개의 과제가 있습니다.` : '마감일을 확인하고 이어서 해결해 보세요.'}</p></div>{active !== '내 과제' && <button className="text-button" onClick={()=>onNavigate('내 과제')}>전체 보기 <ArrowRight size={16}/></button>}</div>
      <div className="task-grid">{tasks.map(t => <TaskCard task={t} key={t.id} onClick={() => onSelect(t)}/>)}</div>
    </>}
  </div>
}

function TaskCard({ task, onClick }) {
  const meta = task.status === 'done' ? ['완료','success'] : task.status === 'progress' ? ['진행 중','warn'] : ['시작 전','neutral']
  return <button className="task-card" onClick={onClick}>
    <div className="task-top"><span className={`badge ${meta[1]}`}>{meta[0]}</span><span className="due"><Clock3 size={14}/>{task.due} 마감</span></div>
    <div><span className="subject">{task.subject}</span><h3>{task.title}</h3><p>{task.description}</p></div>
    <div className="task-footer"><span>{task.attempts ? `${task.attempts}회 시도` : '아직 시작하지 않음'}</span><div className="circle-arrow"><ArrowRight size={17}/></div></div>
  </button>
}

function TaskWorkspace({ task, onBack, onUpdate }) {
  const [messages, setMessages] = useState([{type:'guide', text:'어느 부분에서 막혔나요? 지금까지 생각한 방법을 알려주면 함께 단서를 찾아볼게요.'}])
  const [message, setMessage] = useState('')
  const [answer, setAnswer] = useState('')
  const [entryFile, setEntryFile] = useState(null)
  const [fileError, setFileError] = useState('')
  const [result, setResult] = useState(null)
  const send = () => { if(!message.trim()) return; setMessages(m => [...m, {type:'me',text:message}, {type:'guide',text:'좋아요. 먼저 반복되는 움직임을 찾아볼까요? 오른쪽으로 움직이는 횟수와 위로 움직이는 횟수를 각각 세어 보고, 같은 동작을 묶을 수 있는지 생각해 보세요.'}]); setMessage('') }
  const chooseFile = (file) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.ent')) { setEntryFile(null); setFileError('엔트리 프로젝트 파일(.ent)만 제출할 수 있어요.'); return }
    setEntryFile(file); setFileError(''); setResult(null)
  }
  const submit = () => { if(!entryFile){setFileError('제출할 엔트리 파일을 선택해 주세요.');return} const ok = entryFile.size > 0; setResult(ok ? 'correct' : 'wrong'); onUpdate({status: ok ? 'done' : 'progress', attempts: task.attempts + 1}) }
  return <div className="workspace-page">
    <div className="workspace-header"><button className="back" onClick={onBack}><ArrowLeft size={19}/> 과제 목록</button><div><span className="subject">{task.subject}</span><h1>{task.title}</h1></div><span className="due"><Clock3 size={15}/>{task.due} 마감</span></div>
    <div className="workspace-grid">
      <section className="problem-panel panel"><div className="panel-heading"><span>문제</span><div className="step-dots"><i className="on"></i><i></i><i></i></div></div><div className="problem-body"><div className="problem-no">01</div><h2>{task.description}</h2><div className="scenario"><div className="maze"><span className="cat">🐱</span><span className="flag">🚩</span>{[...Array(8)].map((_,i)=><i key={i}></i>)}</div></div><div className="hint-box"><Lightbulb size={20}/><div><b>생각 열기</b><p>{task.hint}</p></div></div><label className="answer-label">내 해결 방법 <span className="optional">선택</span><textarea value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="사용한 블록과 순서를 간단히 설명해 보세요."/></label><label className={`file-drop ${fileError?'has-error':''}`}><input type="file" accept=".ent,application/octet-stream" onChange={e=>chooseFile(e.target.files?.[0])}/><div className="file-icon">{entryFile?<FileCode2/>:<Upload/>}</div><div><b>{entryFile?entryFile.name:'엔트리 파일 업로드'}</b><p>{entryFile?`${(entryFile.size/1024).toFixed(1)} KB · 다른 파일 선택 가능`:'.ent 파일만 제출할 수 있어요.'}</p></div></label>{fileError&&<p className="field-error">{fileError}</p>}{result && <div className={`result ${result}`}>
        {result === 'correct' ? <><CheckCircle2/><div><b>정답이에요!</b><p>반복 구조를 정확하게 사용했어요.</p></div></> : <><XCircle/><div><b>아직 조금 부족해요.</b><p>블록의 순서와 반복 횟수를 다시 확인해 보세요. 수정 후 다시 제출할 수 있어요.</p></div></>}
      </div>}<button className="primary submit" onClick={submit}>{result === 'wrong' ? '수정해서 다시 제출' : '과제 제출하기'}<ArrowRight size={18}/></button></div></section>
      <section className="chat-panel panel"><div className="chat-heading"><div><MessageCircle size={20}/><div><b>질문하기</b><span>해결 방법을 함께 찾아봐요</span></div></div><span className="online">도움 가능</span></div><div className="messages">{messages.map((m,i)=><div key={i} className={`message ${m.type}`}><span>{m.type === 'guide' ? '길잡이' : '나'}</span><p>{m.text}</p></div>)}</div><div className="quick-prompts"><button onClick={()=>setMessage('어디서부터 시작해야 할지 모르겠어요.')}>어디서 시작할까요?</button><button onClick={()=>setMessage('반복 블록은 언제 사용하나요?')}>반복 블록이 궁금해요</button></div><div className="chat-input"><textarea value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} placeholder="막힌 부분을 질문해 보세요."/><button onClick={send}><Send size={18}/></button></div></section>
    </div>
  </div>
}

function QuestionHistory() { return <div className="history-list">{[
  ['미로를 탈출하는 고양이','반복 블록을 몇 번 사용해야 하나요?','오늘 10:18'],['점수 계산기 만들기','점수를 계속 기억하게 하려면 어떻게 하나요?','9월 10일'],['우주선 장애물 피하기','장애물에 닿은 것을 어떻게 알 수 있나요?','9월 8일']
].map((q,i)=><div className="history-item" key={i}><div className="history-icon"><MessageCircle/></div><div><span>{q[0]}</span><h3>{q[1]}</h3><p>{q[2]}</p></div><ArrowRight/></div>)}</div> }

function TeacherPage({ active, onNavigate }) {
  const [modal, setModal] = useState(false)
  const [editTask, setEditTask] = useState(null)
  if(active === '과제 관리') return <div className="page-wrap"><PageTitle eyebrow="수업 준비" title="과제 관리" desc="학생들이 해결할 과제를 만들고 관리하세요." action={<button className="primary" onClick={()=>setModal(true)}><Plus size={18}/> 새 과제</button>}/><AssignmentManagement onAdd={()=>setModal(true)}/>{modal&&<TaskModal onClose={()=>setModal(false)}/>}</div>
  if(active === '학생 현황') return <div className="page-wrap"><PageTitle eyebrow="학습 관리" title="학생 현황" desc="학생별 과제 진행 상황을 확인하세요."/><ClassTable full /></div>
  return <div className="page-wrap"><PageTitle eyebrow="9월 13일 일요일" title="수업 대시보드" desc="2학년 3반의 학습 현황을 확인하세요." action={<button className="primary" onClick={()=>setModal(true)}><FilePlus2 size={18}/> 과제 만들기</button>}/><div className="dashboard-stats"><StatCard icon={Users} label="전체 학생" value="28" unit="명" tint="blue"/><StatCard icon={ClipboardCheck} label="이번 주 제출" value="21" unit="건" tint="green"/><StatCard icon={CheckCircle2} label="평균 정답률" value="76" unit="%" tint="yellow"/><StatCard icon={MessageCircle} label="오늘 질문" value="14" unit="개" tint="purple"/></div><div className="teacher-grid"><section className="panel dashboard-panel"><div className="section-title compact"><div><h2>2학년 3반 제출 현황</h2><p>미로를 탈출하는 고양이</p></div><button className="text-button" onClick={()=>onNavigate('학생 현황')}>전체 보기 <ArrowRight size={16}/></button></div><ClassTable/></section><section className="panel activity"><div className="section-title compact"><div><h2>최근 활동</h2><p>실시간 학습 소식</p></div></div>{[['김민준','과제를 제출했어요.','10:24'],['박서윤','질문을 남겼어요.','09:51'],['정하은','과제를 수정했어요.','어제'],['윤지호','과제를 제출했어요.','어제']].map((a,i)=><div className="activity-row" key={i}><div className="avatar alt">{a[0][0]}</div><div><b>{a[0]}</b><span>{a[1]}</span></div><time>{a[2]}</time></div>)}</section></div>{modal&&<TaskModal onClose={()=>setModal(false)}/>}</div>
}

function PageTitle({eyebrow,title,desc,action}) { return <div className="page-heading row"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{desc}</p></div>{action}</div> }
function StatCard({icon:Icon,label,value,unit,tint}) { return <div className="stat-card"><div className={`stat-icon ${tint}`}><Icon/></div><div><span>{label}</span><b>{value}<small>{unit}</small></b></div><span className="trend">이번 주</span></div> }

function ClassTable({full=false}) { return <div className={`table-wrap ${full?'panel':''}`}><table><thead><tr><th>학생</th><th>학번</th><th>제출 상태</th><th>결과</th><th>최근 제출</th></tr></thead><tbody>{CLASS_ROWS.map((r,i)=><tr key={i}><td><div className="student-name"><span>{r[0][0]}</span><b>{r[0]}</b></div></td><td>{r[1]}</td><td><Status value={r[2]}/></td><td><Status value={r[3]}/></td><td>{r[4]}</td></tr>)}</tbody></table></div> }
function Status({value}) { const cls = value==='정답'||value==='제출'?'ok':value==='오답'?'bad':value==='확인 필요'?'wait':'plain'; return <span className={`status ${cls}`}>{value}</span> }

function AssignmentManagement({onAdd}) {
  const [query,setQuery]=useState(''); const [classFilter,setClassFilter]=useState('전체 학급'); const [statusFilter,setStatusFilter]=useState('전체 상태'); const [editing,setEditing]=useState(null); const [menu,setMenu]=useState(null)
  const classNames=['2학년 3반','2학년 4반','1학년 2반'];
  const visible=INITIAL_TASKS.filter((t,i)=>t.title.includes(query)&&(classFilter==='전체 학급'||classNames[i]===classFilter)&&(statusFilter==='전체 상태'||(statusFilter==='마감'?i===2:i!==2)))
  return <div className="management"><div className="filter-bar"><div className="search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="과제 이름으로 검색"/></div><select value={classFilter} onChange={e=>setClassFilter(e.target.value)}><option>전체 학급</option>{classNames.map(x=><option key={x}>{x}</option>)}</select><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option>전체 상태</option><option>진행 중</option><option>마감</option></select></div><div className="assignment-list">{visible.length?visible.map((t)=>{const i=INITIAL_TASKS.indexOf(t);return <div className="assignment-row" key={t.id}><div className={`assignment-index i${i}`}>0{i+1}</div><div className="assignment-info"><div><span className="subject">{t.subject}</span><span className={`badge ${i===2?'neutral':'success'}`}>{i===2?'마감':'진행 중'}</span></div><h3>{t.title}</h3><p>{classNames[i]} · {t.due} 마감</p></div><div className="submission-count"><b>{i===0?'21':i===1?'8':'28'}<small> / 28명</small></b><span>제출</span></div><button aria-label="과제 수정" className="icon-btn" onClick={()=>setEditing(t)}><PencilLine size={18}/></button><div className="more-wrap"><button aria-label="더보기" className="icon-btn" onClick={()=>setMenu(menu===t.id?null:t.id)}><MoreHorizontal size={18}/></button>{menu===t.id&&<div className="pop-menu"><button onClick={()=>{setEditing(t);setMenu(null)}}>수정하기</button><button onClick={()=>{alert('과제 링크가 복사되었습니다.');setMenu(null)}}>링크 복사</button><button onClick={()=>{alert('과제가 보관 처리되었습니다.');setMenu(null)}}>보관하기</button></div>}</div></div>}):<div className="empty-state">조건에 맞는 과제가 없습니다.</div>}</div><button className="add-dashed" onClick={onAdd}><Plus/> 새 과제 만들기</button>{editing&&<TaskModal task={editing} onClose={()=>setEditing(null)}/>}</div> }

function TaskModal({onClose,task}) {
  const [saved,setSaved]=useState(false); const [classes,setClasses]=useState(['2학년 3반']); const [answerFile,setAnswerFile]=useState(null); const [fileError,setFileError]=useState('')
  const allClasses=['1학년 1반','1학년 2반','1학년 3반','1학년 4반','2학년 1반','2학년 2반','2학년 3반','2학년 4반','3학년 1반','3학년 2반','3학년 3반','3학년 4반']
  const toggleClass=c=>setClasses(x=>x.includes(c)?x.filter(v=>v!==c):[...x,c])
  const submit=e=>{e.preventDefault();if(!classes.length){alert('대상 학급을 한 곳 이상 선택해 주세요.');return}if(!answerFile){setFileError('정답 파일은 필수입니다.');return}setSaved(true)}
  return <div className="modal-backdrop"><div className="modal"><div className="modal-head"><div><p className="eyebrow">{task?'과제 수정':'새로운 학습'}</p><h2>{saved?(task?'수정되었어요':'과제가 등록되었어요'):(task?'과제 수정':'과제 만들기')}</h2></div><button onClick={onClose}><X/></button></div>{saved?<div className="success-modal"><div><Check/></div><p>{classes.join(', ')}에 과제가 {task?'수정':'등록'}되었습니다.</p><button className="primary" onClick={onClose}>확인</button></div>:<form onSubmit={submit}><label>과제 제목 <Required/><input required defaultValue={task?.title||''} placeholder="과제 제목을 입력하세요"/></label><fieldset className="class-picker"><legend>대상 학급 <Required/></legend><div>{allClasses.map(c=><label key={c} className={classes.includes(c)?'checked':''}><input type="checkbox" checked={classes.includes(c)} onChange={()=>toggleClass(c)}/>{c}</label>)}</div></fieldset><label>제출 기한 <Required/><input required type="datetime-local" defaultValue="2026-09-25T23:59"/></label><label>문제 설명<textarea defaultValue={task?.description||''} placeholder="학생이 해결할 문제를 설명하세요."/></label><label>정답 기준 <Required/><textarea required defaultValue={task?'반복 블록과 이동 블록의 순서가 정답 파일과 일치해야 합니다.':''} placeholder="정답으로 인정할 조건을 구체적으로 입력하세요."/></label><label className={`file-drop teacher-file ${fileError?'has-error':''}`}><input required={!answerFile} type="file" accept=".ent,.pdf,.png,.jpg,.jpeg,.zip" onChange={e=>{setAnswerFile(e.target.files?.[0]||null);setFileError('')}}/><div className="file-icon">{answerFile?<FileCode2/>:<Upload/>}</div><div><b>{answerFile?answerFile.name:'정답 파일 첨부'} <Required/></b><p>엔트리 파일, 문서, 이미지 또는 압축 파일</p></div></label>{fileError&&<p className="field-error">{fileError}</p>}<label>생각 열기 문구<input defaultValue={task?.hint||''} placeholder="첫 단서를 입력하세요."/></label><div className="modal-actions"><button type="button" onClick={onClose}>취소</button><button className="primary" type="submit">{task?'수정 저장':'과제 등록'}</button></div></form>}</div></div>
}
function Required(){return <span className="required">필수</span>}

function AdminPage({ active }) {
  const [admin,setAdmin]=useState('박지훈'); const [toast,setToast]=useState(false)
  const [teachers,setTeachers]=useState(['이서연','김도현','오수민']); const [showAdd,setShowAdd]=useState(false); const [newTeacher,setNewTeacher]=useState('')
  return <div className="page-wrap"><PageTitle eyebrow="학교 관리" title={active==='권한 설정'?'권한 설정':active==='교사 관리'?'교사 관리':'관리자 대시보드'} desc="교사 계정과 관리자 권한을 안전하게 관리하세요."/>
    <div className="admin-highlight"><div className="crown"><Crown/></div><div><span>현재 관리자</span><h2>{admin}</h2><p>관리자는 한 명만 지정할 수 있습니다.</p></div><div className="admin-id">admin · 최근 접속 오늘 08:32</div></div>
    <div className="admin-grid"><section className="panel teacher-list"><div className="section-title compact"><div><h2>교사 권한 관리</h2><p>등록된 교사 {teachers.length}명</p></div><button className="primary small" onClick={()=>setShowAdd(true)}><Plus size={16}/> 교사 추가</button></div>{teachers.map((t,i)=><div className="teacher-row" key={t}><div className="avatar teacher">{t[0]}</div><div><b>{t}</b><span>{i===0?'정보 · 2학년 3반':i===1?'수학 · 1학년 2반':'과학 · 3학년 1반'}</span></div><span className="status ok">교사</span><button aria-label="교사 삭제" className="icon-btn" onClick={()=>{if(confirm(`${t} 교사를 목록에서 삭제할까요?`))setTeachers(x=>x.filter(v=>v!==t))}}><X size={18}/></button></div>)}</section>
      <section className="panel transfer"><div className="transfer-icon"><ShieldCheck/></div><h2>관리자 권한 넘기기</h2><p>선택한 교사가 새 관리자가 되며,<br/>현재 관리자는 교사로 변경됩니다.</p><label>새 관리자 선택<select id="newAdmin"><option>이서연</option><option>김도현</option><option>오수민</option></select></label><button className="outline-danger" onClick={()=>{const v=document.getElementById('newAdmin').value;setAdmin(v);setToast(true);setTimeout(()=>setToast(false),2500)}}>관리자 권한 넘기기</button><div className="warning"><ShieldCheck size={16}/> 이 작업은 즉시 적용됩니다.</div></section>
    </div>{toast&&<div className="toast"><CheckCircle2/> 관리자 권한이 변경되었습니다.</div>}{showAdd&&<div className="modal-backdrop"><div className="modal small-modal"><div className="modal-head"><h2>교사 추가</h2><button onClick={()=>setShowAdd(false)}><X/></button></div><form onSubmit={e=>{e.preventDefault();setTeachers(x=>[...x,newTeacher]);setShowAdd(false);setNewTeacher('')}}><label>교사 이름 <Required/><input required value={newTeacher} onChange={e=>setNewTeacher(e.target.value)} placeholder="이름을 입력하세요"/></label><div className="modal-actions"><button type="button" onClick={()=>setShowAdd(false)}>취소</button><button className="primary">추가</button></div></form></div></div>}</div>
}

export default App
