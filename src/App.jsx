import { useEffect, useMemo, useState } from 'react'
import { ungzip } from 'pako'
import {
  ArrowLeft, ArrowRight, BarChart3, BookOpen, Check, CheckCircle2,
  ChevronDown, CircleUserRound, ClipboardCheck, Clock3, Code2, Crown, Download,
  FilePlus2, FileCode2, LayoutDashboard, Lightbulb, LogOut, Menu, MessageCircle,
  ImagePlus, MoreHorizontal, PencilLine, Plus, Search, Send, ShieldCheck, Sparkles,
  Upload, UserCog, Users, X, XCircle,
} from 'lucide-react'
import { approveStudent, approveTeacher, deleteTask, ensureSession, fetchStoredFile, firebaseReady, listenClasses, listenPendingStudents, listenPendingTeachers, listenStudentsByClass, listenSubmissionsByTask, listenTasks, listenTeachers, loginRegisteredUser, logoutSession, removeTeacher, resetPassword, saveClass, saveTask, saveTeacher, saveUserProfile, submitEntry } from './firebase'

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

function readTarEntries(buffer) {
  const entries = []
  const decoder = new TextDecoder()
  let offset = 0
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512)
    if (header.every(byte => byte === 0)) break
    const name = decoder.decode(header.subarray(0, 100)).replace(/\0.*$/, '')
    const sizeOctal = decoder.decode(header.subarray(124, 136)).replace(/\0.*$/, '').trim()
    const size = parseInt(sizeOctal, 8) || 0
    const dataStart = offset + 512
    entries.push({ name, bytes: buffer.subarray(dataStart, dataStart + size) })
    offset = dataStart + Math.ceil(size / 512) * 512
  }
  return entries
}

async function readEntProjectJson(file) {
  const buffer = await file.arrayBuffer()
  const tarBytes = ungzip(new Uint8Array(buffer))
  const entry = readTarEntries(tarBytes).find(item => /project\.json$/i.test(item.name))
  if (!entry) throw new Error('project.json not found')
  return new TextDecoder('utf-8').decode(entry.bytes)
}

function App() {
  const [userType, setUserType] = useState(null)
  const [active, setActive] = useState('홈')
  const [mobileNav, setMobileNav] = useState(false)
  const [tasks, setTasks] = useState(INITIAL_TASKS)
  const [selectedTask, setSelectedTask] = useState(null)
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [classes, setClasses] = useState(() => {
    try { return JSON.parse(localStorage.getItem('thinkingcoding-classes')) || ['1학년 1반','1학년 2반','2학년 3반','2학년 4반','3학년 1반'] }
    catch { return ['1학년 1반','1학년 2반','2학년 3반','2학년 4반','3학년 1반'] }
  })
  const [serverError, setServerError] = useState('')
  const [teachers, setTeachers] = useState([])
  const [pendingTeachers, setPendingTeachers] = useState([])
  const [pendingStudents, setPendingStudents] = useState([])

  useEffect(() => firebaseUser ? listenTasks(items => { setTasks(items); setServerError('') }, error => setServerError(error.message), { admin: firebaseUser.role === 'admin', classNames: firebaseUser.role === 'student' ? [firebaseUser.className] : firebaseUser.classNames }) : () => {}, [firebaseUser])
  useEffect(() => firebaseUser ? listenClasses(items => { if (items.length) setClasses(items.map(item => item.name)) }, error => setServerError(error.message)) : () => {}, [firebaseUser])
  useEffect(() => firebaseUser?.role === 'admin' ? listenTeachers(setTeachers, error => setServerError(error.message)) : () => {}, [firebaseUser])
  useEffect(() => firebaseUser?.role === 'admin' ? listenPendingTeachers(setPendingTeachers, error => setServerError(error.message)) : () => {}, [firebaseUser])
  useEffect(() => firebaseUser?.role === 'teacher' ? listenPendingStudents(firebaseUser.classNames, setPendingStudents, error => setServerError(error.message)) : () => {}, [firebaseUser])
  useEffect(() => localStorage.setItem('thinkingcoding-classes', JSON.stringify(classes)), [classes])

  const login = async (role, credentials) => {
    try { const user = await loginRegisteredUser(role, credentials); setFirebaseUser(user); setUserType(role); setServerError('') }
    catch (error) { setServerError(error.message); throw error }
  }

  const register = async profile => {
    try {
      const user = await ensureSession(profile.accountType, profile.name, profile.credentials)
      await saveUserProfile(user.uid, {
        name: profile.name,
        ...(profile.accountType === 'student' ? {
          accountType: 'student',
          className: profile.className || '',
          studentNumber: profile.studentNumber || '',
        } : {}),
      })
      await logoutSession()
      setServerError('')
    } catch (error) { setServerError(error.message); throw error }
  }

  if (!userType) return <AuthPage onLogin={login} onRegister={register} classes={classes} />

  const user = firebaseUser ? { ...USERS[userType], name: firebaseUser.name || USERS[userType].name, className: firebaseUser.className || firebaseUser.classNames?.join(', ') || USERS[userType].className } : USERS[userType]
  const navigation = userType === 'student'
    ? [['홈', LayoutDashboard], ['내 과제', BookOpen], ['질문 기록', MessageCircle]]
    : userType === 'teacher'
      ? [['대시보드', LayoutDashboard], ['과제 관리', ClipboardCheck], ['학생 현황', Users]]
      : [['관리', LayoutDashboard], ['교사 관리', UserCog], ['학급 관리', Users], ['권한 설정', ShieldCheck]]

  const page = userType === 'student'
    ? (selectedTask ? <TaskWorkspace task={selectedTask} student={firebaseUser} onBack={() => setSelectedTask(null)} onUpdate={(patch) => setTasks(t => t.map(x => x.id === selectedTask.id ? {...x, ...patch} : x))} /> : <StudentHome tasks={tasks} onSelect={setSelectedTask} active={active} onNavigate={setActive} />)
    : userType === 'teacher' ? <TeacherPage active={active} tasks={tasks} classes={firebaseUser?.role==='admin'||!firebaseUser?.classNames?.length?classes:firebaseUser.classNames} pendingStudents={pendingStudents} onNavigate={setActive} /> : <AdminPage active={active} teachers={teachers} pendingTeachers={pendingTeachers} classes={classes} onClassAdded={name=>setClasses(x=>[...new Set([...x,name])].sort())} />

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="brand"><Logo /><span>생각코딩</span><button className="mobile-close" onClick={() => setMobileNav(false)}><X size={20}/></button></div>
        <nav>
          {navigation.map(([label, Icon]) => <button key={label} className={active === label ? 'active' : ''} onClick={() => { setActive(label); setSelectedTask(null); setMobileNav(false) }}><Icon size={19}/><span>{label}</span></button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-mini"><div className="avatar">{user.name[0]}</div><div><b>{user.name}</b><span>{user.className}</span></div><MoreHorizontal size={18}/></div>
          <button className="logout" onClick={async() => { await logoutSession(); setFirebaseUser(null); setUserType(null) }}><LogOut size={18}/>로그아웃</button>
        </div>
      </aside>
      {mobileNav && <div className="nav-overlay" onClick={() => setMobileNav(false)} />}
      <main className="main">
        <header className="topbar"><button className="menu-btn" onClick={() => setMobileNav(true)}><Menu/></button><div className="mobile-brand"><Logo/><b>생각코딩</b></div><div className="role-pill">{user.role}</div></header>
        {serverError && <div className="firebase-banner error">서버 연결 오류: {serverError}</div>}
        {page}
      </main>
    </div>
  )
}

function Logo() { return <div className="logo"><Code2 size={20}/></div> }

function AuthPage({ onLogin, onRegister, classes }) {
  const [mode, setMode] = useState('login')
  const [role, setRole] = useState('student')
  const [name, setName] = useState('')
  const [className, setClassName] = useState(classes[0] || '')
  const [studentNumber, setStudentNumber] = useState('')
  const [terms, setTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [adminId, setAdminId] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const authenticate = async (useGoogle = false) => {
    if (mode === 'signup' && !terms) return alert('개인정보 수집 및 이용에 동의해 주세요.')
    try {
      setLoading(true)
      setAuthError('')
      const credentials = role === 'admin' ? { id: adminId, password: adminPassword } : useGoogle ? undefined : { email, password }
      if (mode === 'login') await onLogin(role, credentials)
      else {
        await onRegister({ accountType: role, name, className: role === 'student' ? className : '', studentNumber: role === 'student' ? studentNumber : '', credentials })
        setMode('login'); setPassword('')
        alert(role === 'teacher' ? '회원가입이 완료되었습니다. 관리자 승인 후 로그인할 수 있어요.' : '회원가입이 완료되었습니다. 담당 선생님의 승인 후 로그인할 수 있어요.')
      }
    } catch (error) {
      const friendly = error.code === 'auth/email-already-in-use' ? '이미 가입된 이메일입니다. 로그인 화면을 이용해 주세요.' : error.code === 'auth/invalid-credential' ? '이메일 또는 비밀번호가 올바르지 않습니다.' : error.code === 'auth/weak-password' ? '비밀번호는 6자 이상이어야 합니다.' : error.code === 'auth/popup-closed-by-user' ? 'Google 계정 선택이 취소되었습니다.' : error.message
      setAuthError(friendly)
    } finally { setLoading(false) }
  }
  const submit = e => { e.preventDefault(); authenticate(false) }
  const forgotPassword = async () => {
    if (!email) { setAuthError('비밀번호를 재설정할 이메일을 입력해 주세요.'); return }
    try { setLoading(true); setAuthError(''); await resetPassword(email); alert(`${email} 주소로 비밀번호 재설정 메일을 보냈습니다.`) }
    catch (error) { setAuthError(error.code === 'auth/user-not-found' ? '등록되지 않은 이메일입니다.' : error.message) }
    finally { setLoading(false) }
  }
  return <div className="login-page">
    <section className="login-intro">
      <div className="login-brand"><Logo/><span>생각코딩</span></div>
      <div className="intro-copy"><p className="eyebrow">생각하고, 질문하고, 해결하는</p><h1>코딩을 배우는<br/>새로운 방식.</h1><p>정답을 외우기보다 해결하는 힘을 키워요.<br/>한 단계씩, 내 생각으로 완성해 보세요.</p></div>
      <div className="shape shape-a"></div><div className="shape shape-b"></div><div className="dot-grid"></div>
      <p className="copyright">© 2026 생각코딩</p>
    </section>
    <section className="login-panel">
      <form className="login-card signup-card" onSubmit={submit}>
        {role!=='admin'&&<div className="auth-mode"><button type="button" className={mode==='login'?'active':''} onClick={()=>setMode('login')}>로그인</button><button type="button" className={mode==='signup'?'active':''} onClick={()=>setMode('signup')}>회원가입</button></div>}
        <div><p className="eyebrow">{role==='admin'?'관리자 전용':mode==='login'?'다시 만나 반가워요!':'처음 만나 반가워요!'}</p><h2>{role==='admin'?'관리자 로그인':mode==='login'?'로그인':'회원가입'}</h2><p className="muted">{role==='admin'?'관리자 아이디와 비밀번호를 입력하세요.':mode==='login'?'Google 계정으로 안전하게 로그인하세요.':'기본 정보를 입력하고 Google 계정을 연결하세요.'}</p></div>
        <div className="role-tabs">
          {(mode==='login'?[['student','학생'],['teacher','교사'],['admin','관리자']]:[['student','학생'],['teacher','교사']]).map(([key,label]) => <button type="button" key={key} className={role===key?'selected':''} onClick={()=>setRole(key)}>{label}</button>)}
        </div>
        {mode==='login'&&role==='admin'&&<div className="admin-login-fields"><label>아이디<input required autoComplete="username" value={adminId} onChange={e=>setAdminId(e.target.value)} placeholder="admin"/></label><label>비밀번호<input required type="password" autoComplete="current-password" value={adminPassword} onChange={e=>setAdminPassword(e.target.value)} placeholder="비밀번호를 입력하세요"/></label></div>}
        {role!=='admin'&&<div className="email-auth-fields"><label>이메일 <Required/><input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/></label><label>비밀번호 <Required/><input required minLength={6} type="password" autoComplete={mode==='login'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="6자 이상 입력하세요"/></label></div>}
        {mode==='login'&&role!=='admin'&&<button type="button" className="text-button forgot-password" disabled={loading} onClick={forgotPassword}>비밀번호를 잊으셨나요?</button>}
        {mode==='signup'&&<>
          <label>이름 <Required/><input required value={name} onChange={e=>setName(e.target.value)} placeholder="이름을 입력하세요"/></label>
          {role==='student'?<div className="form-row"><label>학급 <Required/><select required value={className} onChange={e=>setClassName(e.target.value)}>{classes.map(c=><option key={c}>{c}</option>)}</select></label><label>학번 <Required/><input required value={studentNumber} onChange={e=>setStudentNumber(e.target.value)} placeholder="예: 2301"/></label></div>:null}
          <div className="teacher-signup-note"><ShieldCheck size={19}/><p>{role==='student'?'담당 선생님이 승인하면 로그인할 수 있어요.':'회원가입 후 관리자가 승인하면 교사 권한이 활성화돼요.'}</p></div>
          <label className="terms-check"><input type="checkbox" checked={terms} onChange={e=>setTerms(e.target.checked)}/><span>회원가입을 위한 개인정보 수집 및 이용에 동의합니다.</span></label>
        </>}
        {authError&&<div className="auth-error">{authError}</div>}
        <button className="primary big" disabled={loading} type="submit">{loading?'계정 확인 중...':mode==='login'&&role==='admin'?'관리자 로그인':mode==='login'?'이메일로 로그인':'이메일로 회원가입'}{!loading&&<ArrowRight size={18}/>}</button>
        {role!=='admin'&&<><div className="auth-divider"><span>또는</span></div><button className="google-auth-button" disabled={loading} type="button" onClick={()=>authenticate(true)}>G&nbsp;&nbsp; Google 계정으로 계속</button></>}
        <p className="demo-note">{mode==='login'&&role==='admin'?'관리자 전용 계정으로 로그인합니다.':mode==='signup'&&role==='teacher'?'교사 권한은 관리자 승인 후 사용할 수 있습니다.':'Google 인증 창에서 사용할 계정을 선택해 주세요.'}</p>
      </form>
    </section>
  </div>
}

function Login({ onLogin }) {
  const [role, setRole] = useState('student')
  const [showPw, setShowPw] = useState(false)
  return <div className="login-page">
    <section className="login-intro">
      <div className="login-brand"><Logo/><span>생각코딩</span></div>
      <div className="intro-copy"><p className="eyebrow">생각하고, 질문하고, 해결하는</p><h1>코딩을 배우는<br/>새로운 방식.</h1><p>정답을 외우기보다 해결하는 힘을 키워요.<br/>한 단계씩, 내 생각으로 완성해 보세요.</p></div>
      <div className="shape shape-a"></div><div className="shape shape-b"></div><div className="dot-grid"></div>
      <p className="copyright">© 2026 생각코딩</p>
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

function TaskWorkspace({ task, student, onBack, onUpdate }) {
  const [messages, setMessages] = useState([{type:'guide', text:'어느 부분에서 막혔나요? 지금까지 생각한 방법을 알려주면 함께 단서를 찾아볼게요.'}])
  const [message, setMessage] = useState('')
  const [questionImage, setQuestionImage] = useState(null)
  const [imageError, setImageError] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [imageDragging, setImageDragging] = useState(false)
  const [entryFile, setEntryFile] = useState(null)
  const [fileError, setFileError] = useState('')
  const [entryDragging, setEntryDragging] = useState(false)
  const [result, setResult] = useState(null); const [uploading,setUploading]=useState(false)
  const [codeDownloading, setCodeDownloading] = useState(false)
  const downloadCode = async () => {
    if(!task.codeFileUrl) return
    try {
      setCodeDownloading(true)
      const { blob, name } = await fetchStoredFile(task.codeFileUrl.replace('firestore://',''))
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = task.codeFileName || name || 'assignment.ent'
      document.body.appendChild(link); link.click(); link.remove()
      URL.revokeObjectURL(url)
    } catch (error) { alert(`다운로드 실패: ${error.message}`) }
    finally { setCodeDownloading(false) }
  }
  const chooseQuestionImage = file => {
    if(!file) return
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setImageError('JPG, PNG, WEBP 이미지만 첨부할 수 있어요.');return}
    if(file.size>2*1024*1024){setImageError('이미지는 2MB 이하만 첨부할 수 있어요.');return}
    const reader=new FileReader()
    reader.onload=()=>{setQuestionImage({name:file.name,url:reader.result});setImageError('')}
    reader.readAsDataURL(file)
  }
  const dropQuestionImage = e => {
    e.preventDefault();setImageDragging(false)
    const file=Array.from(e.dataTransfer?.files||[]).find(item=>item.type.startsWith('image/'))
    if(file) chooseQuestionImage(file)
    else setImageError('JPG, PNG, WEBP 이미지를 놓아 주세요.')
  }
  const pasteQuestionImage = e => {
    const file=Array.from(e.clipboardData?.items||[]).find(item=>item.type.startsWith('image/'))?.getAsFile()
    if(!file) return
    e.preventDefault();chooseQuestionImage(file)
  }
  const send = async () => {
    const question=message.trim(), image=questionImage
    if((!question&&!image)||chatLoading) return
    setMessages(current=>[...current,{type:'me',text:question,image}])
    setMessage('');setQuestionImage(null);setImageError('');setChatLoading(true)
    try{
      const history=messages.slice(-6).map(item=>({role:item.type==='me'?'user':'assistant',text:item.text||''}))
      const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:question,image:image?.url,history,assignment:{title:task.title,description:task.description,hint:task.hint}})})
      const data=await response.json().catch(()=>({}))
      if(!response.ok) throw new Error(data.error||'답변을 받지 못했습니다.')
      setMessages(current=>[...current,{type:'guide',text:data.answer}])
    }catch(error){setMessages(current=>[...current,{type:'guide',text:error.message||'답변을 만드는 중 오류가 발생했습니다.'}])}
    finally{setChatLoading(false)}
  }
  const chooseFile = (file) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.ent')) { setEntryFile(null); setFileError('엔트리 프로젝트 파일(.ent)만 제출할 수 있어요.'); return }
    setEntryFile(file); setFileError(''); setResult(null)
  }
  const removeFile = () => { setEntryFile(null); setFileError(''); setResult(null) }
  const submit = async () => {
    if(!entryFile){setFileError('제출할 엔트리 파일을 선택해 주세요.');return}
    if(!firebaseReady||!student){setFileError('Firebase 연결 후 제출할 수 있습니다. .env 설정을 확인해 주세요.');return}
    if(!task.criteria){setFileError('교사가 정답 기준을 설정하지 않은 과제라 자동 채점을 할 수 없어요. 교사에게 문의해 주세요.');return}
    try{
      setUploading(true); setFileError('')
      let projectJson
      try { projectJson = await readEntProjectJson(entryFile) }
      catch { throw new Error('올바른 엔트리(.ent) 파일이 아니거나 손상되었어요. 다시 확인해 주세요.') }
      const response = await fetch('/api/grade', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title: task.title, description: task.description, criteria: task.criteria, project: projectJson.slice(0, 20000) }) })
      const data = await response.json().catch(()=>({}))
      if(!response.ok) throw new Error(data.error || '채점에 실패했습니다.')
      const correct = !!data.correct
      await submitEntry({taskId:task.id,file:entryFile,explanation:data.feedback||'',student,resultStatus:correct?'correct':'wrong'})
      setResult(correct?'correct':'wrong')
      onUpdate({status:correct?'done':'progress',attempts:(task.attempts||0)+1})
    }catch(error){ setFileError(`제출 실패: ${error.message}`) }
    finally{ setUploading(false) }
  }
  return <div className="workspace-page">
    <div className="workspace-header"><button className="back" onClick={onBack}><ArrowLeft size={19}/> 과제 목록</button><div><span className="subject">{task.subject}</span><h1>{task.title}</h1></div><span className="due"><Clock3 size={15}/>{task.due} 마감</span></div>
    <div className="workspace-grid">
      <section className="problem-panel panel"><div className="panel-heading"><span>과제 안내</span><div className="step-dots"><i className="on"></i><i></i><i></i></div></div><div className="problem-body"><div className="problem-no">과제 설명</div><div className="teacher-description">{task.description?.trim()||'교사가 작성한 과제 설명이 없습니다.'}</div>{task.hint&&<div className="hint-box"><Lightbulb size={20}/><div><b>생각 열기</b><p>{task.hint}</p></div></div>}{task.codeFileUrl&&<><div className="submission-heading"><b>과제 코드</b><p>이어서 작업할 엔트리 기본 코드를 내려받으세요.</p></div><button type="button" className="secondary" disabled={codeDownloading} onClick={downloadCode}><Download size={18}/>{codeDownloading?'다운로드 중...':`${task.codeFileName||'과제 코드'} 다운로드`}</button></>}<div className="submission-heading"><b>과제 파일 제출</b><p>완성한 엔트리 프로젝트 파일을 올려 주세요.</p></div><label className={`file-drop ${fileError?'has-error':''} ${entryDragging?'is-dragging':''}`} onDragEnter={e=>{e.preventDefault();setEntryDragging(true)}} onDragOver={e=>{e.preventDefault();setEntryDragging(true)}} onDragLeave={()=>setEntryDragging(false)} onDrop={e=>{e.preventDefault();setEntryDragging(false);chooseFile(e.dataTransfer.files?.[0])}}><input type="file" accept=".ent,application/octet-stream" onChange={e=>chooseFile(e.target.files?.[0])}/><div className="file-icon">{entryFile?<FileCode2/>:<Upload/>}</div><div><b>{entryDragging?'여기에 놓아 주세요':entryFile?entryFile.name:'엔트리 파일 업로드'}</b><p>{entryDragging?'.ent 파일을 놓으면 선택됩니다.':entryFile?`${(entryFile.size/1024).toFixed(1)} KB · 다른 파일 선택 가능`:'.ent 파일을 선택하거나 여기에 끌어다 놓으세요.'}</p></div>{entryFile&&<button type="button" className="file-remove" aria-label="첨부 파일 삭제" onClick={e=>{e.preventDefault();e.stopPropagation();removeFile()}}><X size={15}/></button>}</label>{fileError&&<p className="field-error">{fileError}</p>}{result && <div className={`result ${result}`}>
        {result === 'correct' ? <><CheckCircle2/><div><b>정답</b></div></> : <><XCircle/><div><b>다시 수정해보세요.</b></div></>}
      </div>}<button className="primary submit" onClick={submit} disabled={uploading}>{uploading?'채점하는 중...':result === 'wrong' ? '수정해서 다시 제출' : '과제 제출하기'}{!uploading&&<ArrowRight size={18}/>}</button></div></section>
      <section className={`chat-panel panel ${imageDragging?'is-image-dragging':''}`} onDragEnter={e=>{if(Array.from(e.dataTransfer?.items||[]).some(item=>item.kind==='file')){e.preventDefault();setImageDragging(true)}}} onDragOver={e=>{if(Array.from(e.dataTransfer?.items||[]).some(item=>item.kind==='file'))e.preventDefault()}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setImageDragging(false)}} onDrop={dropQuestionImage}><div className="chat-heading"><div><MessageCircle size={20}/><div><b>질문하기</b><span>프로그래밍 질문을 설명해 드려요</span></div></div><span className="online">{chatLoading?'답변 중':'도움 가능'}</span></div><div className="messages">{messages.map((m,i)=><div key={i} className={`message ${m.type}`}><span>{m.type === 'guide' ? '길잡이' : '나'}</span>{m.image&&<img className="message-image" src={m.image.url} alt={m.image.name}/>} {m.text&&<p>{m.text}</p>}</div>)}{chatLoading&&<div className="message guide loading"><span>길잡이</span><p>질문을 살펴보고 있어요…</p></div>}</div><div className="quick-prompts"><button onClick={()=>setMessage('어디서부터 시작해야 할지 모르겠어요.')}>어디서 시작할까요?</button><button onClick={()=>setMessage('반복 블록은 언제 사용하나요?')}>반복 블록이 궁금해요</button></div>{imageDragging&&<div className="chat-drop-overlay"><ImagePlus/><b>사진을 여기에 놓아 주세요</b></div>}{questionImage&&<div className="image-preview"><img src={questionImage.url} alt="첨부 이미지 미리보기"/><span>{questionImage.name}</span><button onClick={()=>setQuestionImage(null)} aria-label="첨부 이미지 삭제"><X size={15}/></button></div>}{imageError&&<div className="chat-file-error">{imageError}</div>}<div className="chat-input"><label className="image-attach" title="사진 첨부"><input type="file" accept="image/png,image/jpeg,image/webp" disabled={chatLoading} onChange={e=>{chooseQuestionImage(e.target.files?.[0]);e.target.value=''}}/><ImagePlus size={19}/></label><textarea value={message} disabled={chatLoading} onPaste={pasteQuestionImage} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} placeholder="질문을 입력하거나 사진을 붙여넣으세요."/><button onClick={send} disabled={chatLoading||(!message.trim()&&!questionImage)} aria-label="질문 보내기"><Send size={18}/></button></div></section>
    </div>
  </div>
}

function QuestionHistory() { return <div className="history-list">{[
  ['미로를 탈출하는 고양이','반복 블록을 몇 번 사용해야 하나요?','오늘 10:18'],['점수 계산기 만들기','점수를 계속 기억하게 하려면 어떻게 하나요?','9월 10일'],['우주선 장애물 피하기','장애물에 닿은 것을 어떻게 알 수 있나요?','9월 8일']
].map((q,i)=><div className="history-item" key={i}><div className="history-icon"><MessageCircle/></div><div><span>{q[0]}</span><h3>{q[1]}</h3><p>{q[2]}</p></div><ArrowRight/></div>)}</div> }

function TeacherPage({ active, onNavigate, classes, tasks, pendingStudents }) {
  const [modal, setModal] = useState(false)
  const [editTask, setEditTask] = useState(null)
  if(active === '과제 관리') return <div className="page-wrap"><PageTitle eyebrow="수업 준비" title="과제 관리" desc="학생들이 해결할 과제를 만들고 관리하세요." action={<button className="primary" onClick={()=>setModal(true)}><Plus size={18}/> 새 과제</button>}/><AssignmentManagement tasks={tasks} classes={classes} onAdd={()=>setModal(true)}/>{modal&&<TaskModal classes={classes} onClose={()=>setModal(false)}/>}</div>
  if(active === '학생 현황') return <div className="page-wrap"><PageTitle eyebrow="학습 관리" title="학생 현황" desc="학생별 과제 진행 상황을 확인하세요."/><SubmissionStatus classes={classes} tasks={tasks} full/></div>
  if(active !== '과제 관리' && active !== '학생 현황') return <TeacherDashboard classes={classes} tasks={tasks} pendingStudents={pendingStudents} onNavigate={onNavigate} onAdd={()=>setModal(true)} modal={modal} onClose={()=>setModal(false)}/>
  return <div className="page-wrap"><PageTitle eyebrow="9월 13일 일요일" title="수업 대시보드" desc="2학년 3반의 학습 현황을 확인하세요." action={<button className="primary" onClick={()=>setModal(true)}><FilePlus2 size={18}/> 과제 만들기</button>}/><div className="dashboard-stats"><StatCard icon={Users} label="전체 학생" value="28" unit="명" tint="blue"/><StatCard icon={ClipboardCheck} label="이번 주 제출" value="21" unit="건" tint="green"/><StatCard icon={CheckCircle2} label="평균 정답률" value="76" unit="%" tint="yellow"/><StatCard icon={MessageCircle} label="오늘 질문" value="14" unit="개" tint="purple"/></div><div className="teacher-grid"><section className="panel dashboard-panel"><div className="section-title compact"><div><h2>2학년 3반 제출 현황</h2><p>미로를 탈출하는 고양이</p></div><button className="text-button" onClick={()=>onNavigate('학생 현황')}>전체 보기 <ArrowRight size={16}/></button></div><ClassTable/></section><section className="panel activity"><div className="section-title compact"><div><h2>최근 활동</h2><p>실시간 학습 소식</p></div></div>{[['김민준','과제를 제출했어요.','10:24'],['박서윤','질문을 남겼어요.','09:51'],['정하은','과제를 수정했어요.','어제'],['윤지호','과제를 제출했어요.','어제']].map((a,i)=><div className="activity-row" key={i}><div className="avatar alt">{a[0][0]}</div><div><b>{a[0]}</b><span>{a[1]}</span></div><time>{a[2]}</time></div>)}</section></div>{modal&&<TaskModal classes={classes} onClose={()=>setModal(false)}/>}</div>
}

function TeacherDashboard({classes,tasks,pendingStudents,onNavigate,onAdd,modal,onClose}) {
  const [selectedClass,setSelectedClass]=useState(classes[0]||'')
  const [approving,setApproving]=useState('')
  useEffect(()=>{if(!classes.includes(selectedClass))setSelectedClass(classes[0]||'')},[classes,selectedClass])
  const classTasks=tasks.filter(t=>t.classNames?.includes(selectedClass))
  const approve = async uid => {
    try { setApproving(uid); await approveStudent(uid) }
    catch (error) { alert(`승인 실패: ${error.message}`) }
    finally { setApproving('') }
  }
  return <div className="page-wrap"><PageTitle eyebrow="수업 현황" title="수업 대시보드" desc={`${selectedClass || '담당 학급'}의 학습 현황을 확인하세요.`} action={<button className="primary" onClick={onAdd}><FilePlus2 size={18}/> 과제 만들기</button>}/><div className="dashboard-class-filter"><label>담당 학급<select value={selectedClass} onChange={e=>setSelectedClass(e.target.value)}>{classes.map(c=><option key={c}>{c}</option>)}</select></label><span>관리자가 배정한 학급만 표시됩니다.</span></div><div className="dashboard-stats"><StatCard icon={Users} label="담당 학급" value={String(classes.length)} unit="개" tint="blue"/><StatCard icon={ClipboardCheck} label="등록 과제" value={String(classTasks.length)} unit="건" tint="green"/><StatCard icon={CheckCircle2} label="제출 확인" value="0" unit="건" tint="yellow"/><StatCard icon={MessageCircle} label="학생 질문" value="0" unit="개" tint="purple"/></div>{pendingStudents?.length>0&&<section className="panel teacher-list"><div className="section-title compact"><div><h2>학생 가입 승인</h2><p>{pendingStudents.length}명이 승인을 기다리고 있어요.</p></div></div>{pendingStudents.map(s=><div className="teacher-row" key={s.id}><div className="avatar alt">{s.name?.[0]||'학'}</div><div><b>{s.name||'이름 없음'}</b><span>{s.className||'학급 미지정'} · {s.studentNumber||'학번 없음'}</span></div><button className="primary small" disabled={approving===s.id} onClick={()=>approve(s.id)}>{approving===s.id?'승인 중...':'승인'}</button></div>)}</section>}<section className="panel dashboard-panel"><div className="section-title compact"><div><h2>{selectedClass} 과제</h2><p>{classTasks.length ? `${classTasks.length}개의 과제가 등록되어 있습니다.` : '등록된 과제가 없습니다.'}</p></div><button className="text-button" onClick={()=>onNavigate('과제 관리')}>과제 관리 <ArrowRight size={16}/></button></div>{classTasks.length?<div className="task-grid">{classTasks.map(t=><TaskCard key={t.id} task={t} onClick={()=>onNavigate('과제 관리')}/>)}</div>:<div className="empty-state">이 학급에 등록된 과제가 없습니다.</div>}</section>{classTasks.length>0&&<SubmissionStatus className={selectedClass} classes={classes} tasks={tasks}/>}{modal&&<TaskModal classes={classes} onClose={onClose}/>}</div>
}

function PageTitle({eyebrow,title,desc,action}) { return <div className="page-heading row"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{desc}</p></div>{action}</div> }
function StatCard({icon:Icon,label,value,unit,tint}) { return <div className="stat-card"><div className={`stat-icon ${tint}`}><Icon/></div><div><span>{label}</span><b>{value}<small>{unit}</small></b></div><span className="trend">이번 주</span></div> }

function formatSubmittedAt(timestamp) {
  try { return timestamp.toDate().toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return '-' }
}

function SubmissionStatus({ className, classes, tasks, full=false }) {
  const [selectedClass, setSelectedClass] = useState(className || classes[0] || '')
  useEffect(() => { if (className) setSelectedClass(className) }, [className])
  useEffect(() => { if (!className && !classes.includes(selectedClass)) setSelectedClass(classes[0] || '') }, [classes, className, selectedClass])
  const classTasks = tasks.filter(t => t.classNames?.includes(selectedClass))
  const [selectedTaskId, setSelectedTaskId] = useState('')
  useEffect(() => { if (!classTasks.some(t => t.id === selectedTaskId)) setSelectedTaskId(classTasks[0]?.id || '') }, [classTasks, selectedTaskId])
  const [roster, setRoster] = useState([])
  const [submissions, setSubmissions] = useState([])
  useEffect(() => listenStudentsByClass(selectedClass, setRoster, () => {}), [selectedClass])
  useEffect(() => listenSubmissionsByTask(selectedTaskId, setSubmissions, () => {}), [selectedTaskId])
  const selectedTask = classTasks.find(t => t.id === selectedTaskId)
  return <section className="panel dashboard-panel">
    <div className="section-title compact">
      <div><h2>제출 현황</h2><p>{selectedTask ? selectedTask.title : '등록된 과제가 없습니다.'}</p></div>
      <div className="status-filters">
        {!className && <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>{classes.map(c => <option key={c}>{c}</option>)}</select>}
        {classTasks.length > 1 && <select value={selectedTaskId} onChange={e => setSelectedTaskId(e.target.value)}>{classTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select>}
      </div>
    </div>
    {classTasks.length ? <ClassTable full={full} roster={roster} submissions={submissions} /> : <div className="empty-state">이 학급에 등록된 과제가 없습니다.</div>}
  </section>
}

function ClassTable({full=false, roster=[], submissions=[]}) {
  const latestByStudent = {}
  submissions.forEach(sub => {
    const prev = latestByStudent[sub.studentId]
    if (!prev || (sub.submittedAt?.seconds || 0) >= (prev.submittedAt?.seconds || 0)) latestByStudent[sub.studentId] = sub
  })
  const rows = roster.map(student => {
    const sub = latestByStudent[student.id]
    const state = !sub ? 'none' : sub.status === 'correct' ? 'correct' : 'wrong'
    return { student, sub, state }
  })
  return <div className={`table-wrap ${full?'panel':''}`}><table><thead><tr><th>학생</th><th>학번</th><th>제출 상태</th><th>결과</th><th>최근 제출</th></tr></thead><tbody>
    {rows.length ? rows.map(({student,sub,state}) => <tr key={student.id}>
      <td><div className="student-name"><span className={`student-avatar ${state}`}>{student.name?.[0]||'학'}</span><b>{student.name||'이름 없음'}</b></div></td>
      <td>{student.studentNumber||'-'}</td>
      <td><span className={`status ${state==='none'?'plain':'ok'}`}>{state==='none'?'미제출':'제출'}</span></td>
      <td><span className={`status ${state==='correct'?'ok':state==='wrong'?'bad':'plain'}`}>{state==='correct'?'정답':state==='wrong'?'오답':'-'}</span></td>
      <td>{sub?.submittedAt ? formatSubmittedAt(sub.submittedAt) : '-'}</td>
    </tr>) : <tr><td colSpan={5}><div className="empty-state">등록된 학생이 없습니다.</div></td></tr>}
  </tbody></table></div>
}

function AssignmentManagement({onAdd, classes, tasks}) {
  const [query,setQuery]=useState(''); const [classFilter,setClassFilter]=useState('전체 학급'); const [statusFilter,setStatusFilter]=useState('전체 상태'); const [editing,setEditing]=useState(null); const [menu,setMenu]=useState(null)
  const isTaskClosed = t => t.deadline ? new Date(t.deadline) < new Date() : false
  const visible=tasks.filter(t=>t.title.includes(query)&&(classFilter==='전체 학급'||t.classNames?.includes(classFilter))&&(statusFilter==='전체 상태'||(statusFilter==='마감'?isTaskClosed(t):!isTaskClosed(t))))
  return <div className="management"><div className="filter-bar"><div className="search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="과제 이름으로 검색"/></div><select value={classFilter} onChange={e=>setClassFilter(e.target.value)}><option>전체 학급</option>{classes.map(x=><option key={x}>{x}</option>)}</select><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option>전체 상태</option><option>진행 중</option><option>마감</option></select></div><div className="assignment-list">{visible.length?visible.map((t,i)=><AssignmentRow key={t.id} task={t} index={i} closed={isTaskClosed(t)} onEdit={()=>{setEditing(t);setMenu(null)}} menuOpen={menu===t.id} onToggleMenu={()=>setMenu(menu===t.id?null:t.id)} onCloseMenu={()=>setMenu(null)}/>):<div className="empty-state">조건에 맞는 과제가 없습니다.</div>}</div><button className="add-dashed" onClick={onAdd}><Plus/> 새 과제 만들기</button>{editing&&<TaskModal classes={classes} task={editing} onClose={()=>setEditing(null)}/>}</div> }

function AssignmentRow({task, index, closed, onEdit, menuOpen, onToggleMenu, onCloseMenu}) {
  const classNames = task.classNames || []
  const [rosterByClass, setRosterByClass] = useState({})
  const [submissions, setSubmissions] = useState([])
  useEffect(() => {
    const unsubs = classNames.map(c => listenStudentsByClass(c, students => setRosterByClass(prev => ({...prev, [c]: students})), () => {}))
    return () => unsubs.forEach(unsub => unsub())
  }, [classNames.join(',')])
  useEffect(() => listenSubmissionsByTask(task.id, setSubmissions, () => {}), [task.id])
  const rosterCount = Object.values(rosterByClass).reduce((sum, list) => sum + list.length, 0)
  const submittedCount = new Set(submissions.map(s => s.studentId)).size
  const [deleting, setDeleting] = useState(false)
  const handleDelete = async () => {
    onCloseMenu()
    if (!confirm(`"${task.title}" 과제를 삭제할까요? 삭제하면 되돌릴 수 없습니다.`)) return
    try { setDeleting(true); await deleteTask(task.id) } catch (error) { alert(`삭제 실패: ${error.message}`) } finally { setDeleting(false) }
  }
  return <div className="assignment-row">
    <div className={`assignment-index i${index % 3}`}>{String(index + 1).padStart(2, '0')}</div>
    <div className="assignment-info"><div><span className="subject">{task.subject}</span><span className={`badge ${closed ? 'neutral' : 'success'}`}>{closed ? '마감' : '진행 중'}</span></div><h3>{task.title}</h3><p>{classNames.join(', ') || '대상 학급 없음'} · {task.deadline || task.due} 마감</p></div>
    <div className="submission-count"><b>{submittedCount}<small> / {rosterCount}명</small></b><span>제출</span></div>
    <button aria-label="과제 수정" className="icon-btn" onClick={onEdit}><PencilLine size={18}/></button>
    <div className="more-wrap"><button aria-label="더보기" className="icon-btn" onClick={onToggleMenu}><MoreHorizontal size={18}/></button>{menuOpen && <div className="pop-menu"><button onClick={onEdit}>수정하기</button><button onClick={() => { navigator.clipboard?.writeText(`${location.origin}/task/${task.id}`); alert('과제 링크가 복사되었습니다.'); onCloseMenu() }}>링크 복사</button><button className="danger" disabled={deleting} onClick={handleDelete}>{deleting ? '삭제 중...' : '삭제하기'}</button></div>}</div>
  </div>
}

function TaskModal({onClose,task,classes:availableClasses}) {
  const [saved,setSaved]=useState(false); const [selectedClasses,setSelectedClasses]=useState(task?.classNames||availableClasses.slice(0,1)); const [codeFile,setCodeFile]=useState(null); const [answerFile,setAnswerFile]=useState(null); const [fileError,setFileError]=useState(''); const [saving,setSaving]=useState(false)
  const toggleClass=c=>setSelectedClasses(x=>x.includes(c)?x.filter(v=>v!==c):[...x,c])
  const submit=async e=>{e.preventDefault();if(!selectedClasses.length){alert('대상 학급을 한 곳 이상 선택해 주세요.');return}if(!codeFile&&!task?.codeFileUrl){setFileError('과제 코드 파일은 필수입니다.');return}if(!answerFile&&!task?.answerFileUrl){setFileError('정답 파일은 필수입니다.');return}if(!firebaseReady){setFileError('Firebase 환경변수를 먼저 설정해 주세요.');return}const form=new FormData(e.currentTarget);try{setSaving(true);await saveTask({task,title:form.get('title'),classNames:selectedClasses,deadline:form.get('deadline'),description:form.get('description'),criteria:form.get('criteria'),hint:form.get('hint'),codeFile,answerFile});setSaved(true)}catch(error){setFileError(`등록 실패: ${error.message}`)}finally{setSaving(false)}}
  return <div className="modal-backdrop"><div className="modal"><div className="modal-head"><div><p className="eyebrow">{task?'과제 수정':'새로운 학습'}</p><h2>{saved?(task?'수정되었어요':'과제가 등록되었어요'):(task?'과제 수정':'과제 만들기')}</h2></div><button onClick={onClose}><X/></button></div>{saved?<div className="success-modal"><div><Check/></div><p>{selectedClasses.join(', ')}에 과제가 {task?'수정':'등록'}되었습니다.</p><button className="primary" onClick={onClose}>확인</button></div>:<form onSubmit={submit}><label>과제 제목 <Required/><input name="title" required defaultValue={task?.title||''} placeholder="과제 제목을 입력하세요"/></label><fieldset className="class-picker"><legend>대상 학급 <Required/></legend><div>{availableClasses.map(c=><label key={c} className={selectedClasses.includes(c)?'checked':''}><input type="checkbox" checked={selectedClasses.includes(c)} onChange={()=>toggleClass(c)}/>{c}</label>)}</div></fieldset><label>제출 기한 <Required/><input name="deadline" required type="datetime-local" defaultValue={task?.deadline||'2026-09-25T23:59'}/></label><label>문제 설명<textarea name="description" defaultValue={task?.description||''} placeholder="학생이 해결할 문제를 설명하세요."/></label><label>정답 기준 <Required/><textarea name="criteria" required defaultValue={task?.criteria||''} placeholder="정답으로 인정할 조건을 구체적으로 입력하세요."/></label><label className={`file-drop teacher-file ${fileError?'has-error':''}`}><input type="file" accept=".ent" onChange={e=>{setCodeFile(e.target.files?.[0]||null);setFileError('')}}/><div className="file-icon">{codeFile||task?.codeFileName?<FileCode2/>:<Upload/>}</div><div><b>{codeFile?.name||task?.codeFileName||'과제 코드 첨부'} <Required/></b><p>학생에게 내려줄 엔트리 기본 코드 파일</p></div></label><label className={`file-drop teacher-file ${fileError?'has-error':''}`}><input type="file" accept=".ent,.pdf,.png,.jpg,.jpeg,.zip" onChange={e=>{setAnswerFile(e.target.files?.[0]||null);setFileError('')}}/><div className="file-icon">{answerFile||task?.answerFileName?<FileCode2/>:<Upload/>}</div><div><b>{answerFile?.name||task?.answerFileName||'과제 정답 첨부'} <Required/></b><p>채점 참고용 정답 파일, 문서, 이미지 또는 압축 파일</p></div></label>{fileError&&<p className="field-error">{fileError}</p>}<label>생각 열기 문구<input name="hint" defaultValue={task?.hint||''} placeholder="첫 단서를 입력하세요."/></label><div className="modal-actions"><button type="button" onClick={onClose}>취소</button><button className="primary" disabled={saving} type="submit">{saving?'서버에 저장 중...':task?'수정 저장':'과제 등록'}</button></div></form>}</div></div>
}
function Required(){return <span className="required">필수</span>}

function AdminPage({ active, classes, onClassAdded, teachers, pendingTeachers }) {
  const [admin,setAdmin]=useState('박지훈'); const [toast,setToast]=useState(false)
  const [showAdd,setShowAdd]=useState(false); const [approvingUid,setApprovingUid]=useState(''); const [newTeacher,setNewTeacher]=useState(''); const [teacherEmail,setTeacherEmail]=useState(''); const [teacherClasses,setTeacherClasses]=useState([]); const [teacherSaving,setTeacherSaving]=useState(false); const [newClass,setNewClass]=useState(''); const [classSaving,setClassSaving]=useState(false)
  const closeAddModal = () => { setShowAdd(false); setApprovingUid(''); setNewTeacher(''); setTeacherEmail(''); setTeacherClasses([]) }
  const openApproval = t => { const existingInvite = teachers.find(inv => inv.email === t.email); setApprovingUid(t.id); setNewTeacher(t.name||''); setTeacherEmail(t.email||''); setTeacherClasses(existingInvite?.classNames||[]); setShowAdd(true) }
  return <div className="page-wrap"><PageTitle eyebrow="학교 관리" title={active==='권한 설정'?'권한 설정':active==='교사 관리'?'교사 관리':active==='학급 관리'?'학급 관리':'관리자 대시보드'} desc={active==='학급 관리'?'과제에 사용할 학급을 추가하고 확인하세요.':'교사 계정과 관리자 권한을 안전하게 관리하세요.'}/>
    {active==='학급 관리'?<section className="panel teacher-list"><div className="section-title compact"><div><h2>학급 관리</h2><p>등록된 학급 {classes.length}개 · 학년과 반을 자유롭게 추가할 수 있어요.</p></div></div><form className="class-add-form" onSubmit={async e=>{e.preventDefault();const name=newClass.trim();if(classes.includes(name)){alert('이미 등록된 학급입니다.');return}try{setClassSaving(true);if(firebaseReady)await saveClass(name);onClassAdded(name);setNewClass('');setToast(true);setTimeout(()=>setToast(false),2500)}catch(error){alert(`학급 등록 실패: ${error.message}`)}finally{setClassSaving(false)}}}><label>새 학급 이름 <Required/><div><input required value={newClass} onChange={e=>setNewClass(e.target.value)} placeholder="예: 1학년 5반, 4학년 2반"/><button className="primary" disabled={classSaving}>{classSaving?'추가 중...':'학급 추가'}</button></div></label><small>{firebaseReady?'서버에 안전하게 저장됩니다.':'현재 기기의 브라우저에 저장됩니다.'}</small></form><div className="class-list">{classes.map((name,i)=><div key={name}><span>{String(i+1).padStart(2,'0')}</span><b>{name}</b><em>사용 중</em></div>)}</div></section>:<>
    <div className="admin-highlight"><div className="crown"><Crown/></div><div><span>현재 관리자</span><h2>{admin}</h2><p>관리자는 한 명만 지정할 수 있습니다.</p></div><div className="admin-id">admin · 최근 접속 오늘 08:32</div></div>
    {pendingTeachers?.length>0&&<section className="panel teacher-list"><div className="section-title compact"><div><h2>교사 가입 승인</h2><p>{pendingTeachers.length}명이 승인을 기다리고 있어요.</p></div></div>{pendingTeachers.map(t=><div className="teacher-row" key={t.id}><div className="avatar teacher">{t.name?.[0]||'교'}</div><div><b>{t.name||'이름 없음'}</b><span>{t.email}</span></div><button className="primary small" onClick={()=>openApproval(t)}>승인하기</button></div>)}</section>}
    <div className="admin-grid"><section className="panel teacher-list"><div className="section-title compact"><div><h2>교사 권한 관리</h2><p>서버에 등록된 교사 {teachers.length}명</p></div><button className="primary small" onClick={()=>setShowAdd(true)}><Plus size={16}/> 교사 추가</button></div>{teachers.length?teachers.map(t=><div className="teacher-row" key={t.email}><div className="avatar teacher">{t.name?.[0]||'교'}</div><div><b>{t.name}</b><span>{t.email} · {t.classNames?.join(', ')||'담당 학급 없음'}</span></div><span className="status ok">교사</span><button aria-label="교사 삭제" className="icon-btn" onClick={async()=>{if(confirm(`${t.name} 교사의 권한을 삭제할까요?`))try{await removeTeacher(t.email)}catch(error){alert(`삭제 실패: ${error.message}`)}}}><X size={18}/></button></div>):<div className="empty-state">등록된 교사가 없습니다. 교사 이름과 이메일, 담당 학급을 등록해 주세요.</div>}</section>
      <section className="panel transfer"><div className="transfer-icon"><ShieldCheck/></div><h2>관리자 권한 넘기기</h2><p>선택한 교사가 새 관리자가 되며,<br/>현재 관리자는 교사로 변경됩니다.</p><label>새 관리자 선택<select id="newAdmin"><option>이서연</option><option>김도현</option><option>오수민</option></select></label><button className="outline-danger" onClick={()=>{const v=document.getElementById('newAdmin').value;setAdmin(v);setToast(true);setTimeout(()=>setToast(false),2500)}}>관리자 권한 넘기기</button><div className="warning"><ShieldCheck size={16}/> 이 작업은 즉시 적용됩니다.</div></section>
    </div></>}{toast&&<div className="toast"><CheckCircle2/> {active==='학급 관리'?'학급이 추가되었습니다.':'교사 정보가 서버에 저장되었습니다.'}</div>}{showAdd&&<div className="modal-backdrop"><div className="modal"><div className="modal-head"><div><p className="eyebrow">교사 권한</p><h2>{approvingUid?'교사 가입 승인':'교사 추가'}</h2></div><button onClick={closeAddModal}><X/></button></div><form onSubmit={async e=>{e.preventDefault();if(!teacherClasses.length){alert('담당 학급을 한 곳 이상 선택해 주세요.');return}try{setTeacherSaving(true);if(approvingUid)await approveTeacher({uid:approvingUid,name:newTeacher,email:teacherEmail,classNames:teacherClasses});else await saveTeacher({name:newTeacher,email:teacherEmail,classNames:teacherClasses});closeAddModal();setToast(true);setTimeout(()=>setToast(false),2500)}catch(error){alert(`교사 등록 실패: ${error.message}`)}finally{setTeacherSaving(false)}}}><div className="form-row"><label>교사 이름 <Required/><input required value={newTeacher} onChange={e=>setNewTeacher(e.target.value)} placeholder="이름을 입력하세요"/></label><label>{approvingUid?'이메일':'Google 이메일'} <Required/><input required type="email" readOnly={!!approvingUid} value={teacherEmail} onChange={e=>setTeacherEmail(e.target.value)} placeholder="teacher@gmail.com"/></label></div><fieldset className="class-picker"><legend>담당 학급 <Required/></legend><div>{classes.map(c=><label key={c} className={teacherClasses.includes(c)?'checked':''}><input type="checkbox" checked={teacherClasses.includes(c)} onChange={()=>setTeacherClasses(x=>x.includes(c)?x.filter(v=>v!==c):[...x,c])}/>{c}</label>)}</div></fieldset><p className="permission-note">선택한 학급의 과제와 학생 제출 현황을 관리할 수 있습니다.</p><div className="modal-actions"><button type="button" onClick={closeAddModal}>취소</button><button className="primary" disabled={teacherSaving}>{teacherSaving?'서버에 저장 중...':approvingUid?'승인 완료':'교사 추가'}</button></div></form></div></div>}</div>
}

export default App
