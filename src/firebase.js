import { initializeApp } from 'firebase/app'
import { createUserWithEmailAndPassword, getAuth, GoogleAuthProvider, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth'
import {
  addDoc, Bytes, collection, deleteDoc, doc, getDoc, getFirestore, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyD2fRWQcr3aXgFkqNbz0YhxwZRzq9ub7ec',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'test-pizza-qeyr.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'test-pizza-qeyr',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'test-pizza-qeyr.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1024973991639',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1024973991639:web:cab56f38e9e543b565ca92',
}

export const firebaseReady = Object.values(firebaseConfig).every(Boolean)
const app = firebaseReady ? initializeApp(firebaseConfig) : null
export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null
const FIRESTORE_FILE_LIMIT = 10 * 1024 * 1024
const CHUNK_SIZE = 600 * 1024

async function saveFileToFirestore(file, kind, ownerId) {
  if (file.size > FIRESTORE_FILE_LIMIT) throw new Error('파일은 10MB 이하만 업로드할 수 있습니다.')
  const fileRef = doc(collection(db, 'files'))
  const buffer = await file.arrayBuffer()
  const chunks = []
  for (let offset = 0; offset < buffer.byteLength; offset += CHUNK_SIZE) {
    chunks.push(new Uint8Array(buffer.slice(offset, offset + CHUNK_SIZE)))
  }
  await setDoc(fileRef, {
    name: file.name, size: file.size, type: file.type || 'application/octet-stream',
    kind, ownerId, chunkCount: chunks.length, createdAt: serverTimestamp(),
  })
  for (let start = 0; start < chunks.length; start += 400) {
    const batch = writeBatch(db)
    chunks.slice(start, start + 400).forEach((chunk, index) => {
      batch.set(doc(db, 'files', fileRef.id, 'chunks', String(start + index).padStart(5, '0')), { data: Bytes.fromUint8Array(chunk) })
    })
    await batch.commit()
  }
  return { id: fileRef.id, name: file.name }
}

export async function ensureSession(role, name, credentials = {}) {
  if (!firebaseReady) return null
  const credential = credentials.email
    ? await createUserWithEmailAndPassword(auth, credentials.email.trim().toLowerCase(), credentials.password)
    : auth.currentUser ? { user: auth.currentUser } : await signInWithPopup(auth, new GoogleAuthProvider())
  const email = credential.user.email?.toLowerCase()
  await setDoc(doc(db, 'users', credential.user.uid), {
    name: credential.user.displayName || name,
    email,
    accountType: role,
    approved: false,
    lastSelectedScreen: role,
    updatedAt: serverTimestamp(),
  }, { merge: true })
  return { uid: credential.user.uid, name: credential.user.displayName || name, email, role, accountType: role, approved: false }
}

export async function loginRegisteredUser(screenRole, credentials = {}) {
  if (!firebaseReady) throw new Error('Firebase가 연결되지 않았습니다.')
  if (screenRole === 'admin' && credentials.id !== 'admin') throw new Error('관리자 아이디 또는 비밀번호가 올바르지 않습니다.')
  const credential = screenRole === 'admin'
    ? await signInWithEmailAndPassword(auth, 'admin@test0913.app', credentials.password || '')
    : credentials.email
      ? await signInWithEmailAndPassword(auth, credentials.email.trim().toLowerCase(), credentials.password || '')
      : auth.currentUser ? { user: auth.currentUser } : await signInWithPopup(auth, new GoogleAuthProvider())
  const email = credential.user.email?.toLowerCase()
  const profileSnapshot = await getDoc(doc(db, 'users', credential.user.uid))
  if (['admin@test0913.app','su1413911@gmail.com'].includes(email) && screenRole === 'admin') {
    await setDoc(doc(db, 'users', credential.user.uid), { name: credential.user.displayName || '관리자', email, updatedAt: serverTimestamp() }, { merge: true })
    return { uid: credential.user.uid, name: credential.user.displayName || '관리자', email, role: 'admin', classNames: [] }
  }
  if (!profileSnapshot.exists()) throw new Error('회원가입되지 않은 계정입니다. 먼저 회원가입을 진행해 주세요.')
  const profile = profileSnapshot.data()
  const actualRole = ['admin@test0913.app','su1413911@gmail.com'].includes(email) ? 'admin' : (profile.role === 'teacher' || profile.accountType === 'teacher') ? 'teacher' : profile.accountType === 'student' ? 'student' : null
  if (actualRole !== screenRole) throw new Error(`이 계정은 ${screenRole === 'teacher' ? '교사' : screenRole === 'student' ? '학생' : '관리자'}로 등록되어 있지 않습니다.`)
  if (actualRole === 'student' && profile.approved === false) throw new Error('담당 선생님의 승인을 기다리고 있어요.')
  let assignedClasses = profile.classNames || []
  if (actualRole === 'teacher') {
    if (profile.approved === false) throw new Error('관리자 승인을 기다리고 있어요.')
    const invite = await getDoc(doc(db, 'teacherInvites', email))
    if (!invite.exists()) throw new Error('교사 권한이 회수되었거나 등록되지 않았습니다.')
    assignedClasses = invite.data().classNames || []
  }
  return { uid: credential.user.uid, name: profile.name || credential.user.displayName, email, role: actualRole, className: profile.className || '', classNames: assignedClasses }
}

export async function resetPassword(email) {
  if (!firebaseReady) throw new Error('Firebase가 연결되지 않았습니다.')
  await sendPasswordResetEmail(auth, email.trim().toLowerCase())
}

export async function logoutSession() {
  if (auth?.currentUser) await signOut(auth)
}

export function listenTeachers(callback, onError) {
  if (!firebaseReady) return () => {}
  return onSnapshot(query(collection(db, 'teacherInvites'), orderBy('name')), snapshot => {
    callback(snapshot.docs.map(item => ({ id: item.id, ...item.data() })))
  }, onError)
}

export async function saveTeacher({ name, email, classNames }) {
  const normalizedEmail = email.trim().toLowerCase()
  await setDoc(doc(db, 'teacherInvites', normalizedEmail), {
    name: name.trim(), email: normalizedEmail, classNames,
    status: 'invited', updatedAt: serverTimestamp(),
  }, { merge: true })
}

export async function removeTeacher(email) {
  await deleteDoc(doc(db, 'teacherInvites', email.trim().toLowerCase()))
}

export function listenPendingTeachers(callback, onError) {
  if (!firebaseReady) return () => {}
  return onSnapshot(query(collection(db, 'users'), where('accountType', '==', 'teacher'), where('approved', '==', false)), snapshot => {
    callback(snapshot.docs.map(item => ({ id: item.id, ...item.data() })))
  }, onError)
}

export async function approveTeacher({ uid, name, email, classNames }) {
  await saveTeacher({ name, email, classNames })
  await updateDoc(doc(db, 'users', uid), { role: 'teacher', classNames, approved: true, updatedAt: serverTimestamp() })
}

export function listenPendingStudents(classNames, callback, onError) {
  if (!firebaseReady) return () => {}
  return onSnapshot(query(collection(db, 'users'), where('accountType', '==', 'student'), where('approved', '==', false)), snapshot => {
    const items = snapshot.docs.map(item => ({ id: item.id, ...item.data() }))
    callback(classNames?.length ? items.filter(student => classNames.includes(student.className)) : items)
  }, onError)
}

export async function approveStudent(uid) {
  await updateDoc(doc(db, 'users', uid), { approved: true, updatedAt: serverTimestamp() })
}

export async function saveUserProfile(userId, profile) {
  await setDoc(doc(db, 'users', userId), {
    ...profile,
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

export function listenTasks(callback, onError, access = {}) {
  if (!firebaseReady) return () => {}
  const constraints = []
  if (!access.admin && access.classNames?.length) constraints.push(access.classNames.length === 1 ? where('classNames', 'array-contains', access.classNames[0]) : where('classNames', 'array-contains-any', access.classNames.slice(0, 30)))
  return onSnapshot(query(collection(db, 'tasks'), ...constraints), snapshot => {
    const items = snapshot.docs.map(item => ({ id: item.id, ...item.data() }))
    items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    callback(items)
  }, onError)
}

export function listenClasses(callback, onError) {
  if (!firebaseReady) return () => {}
  return onSnapshot(query(collection(db, 'classes'), orderBy('name')), snapshot => {
    callback(snapshot.docs.map(item => ({ id: item.id, ...item.data() })))
  }, onError)
}

export async function saveClass(name) {
  const id = name.replaceAll(' ', '-')
  await setDoc(doc(db, 'classes', id), { name, createdAt: serverTimestamp() })
}

export async function saveTask({ task, title, classNames, deadline, description, criteria, hint, answerFile }) {
  const taskRef = task?.id ? doc(db, 'tasks', String(task.id)) : doc(collection(db, 'tasks'))
  let answerFileUrl = task?.answerFileUrl || ''
  let answerFileName = task?.answerFileName || ''
  if (answerFile) {
    const savedFile = await saveFileToFirestore(answerFile, 'answer', auth.currentUser.uid)
    answerFileUrl = `firestore://${savedFile.id}`
    answerFileName = savedFile.name
  }
  const data = { title, classNames, deadline, description, criteria, hint, answerFileUrl, answerFileName, updatedAt: serverTimestamp() }
  if (task?.id) await updateDoc(taskRef, data)
  else await setDoc(taskRef, { ...data, subject: '블록 프로그래밍', status: 'todo', attempts: 0, createdAt: serverTimestamp() })
  return taskRef.id
}

export async function submitEntry({ taskId, file, explanation, student, resultStatus }) {
  const submissionRef = doc(collection(db, 'submissions'))
  const savedFile = await saveFileToFirestore(file, 'submission', student.uid)
  await setDoc(submissionRef, {
    taskId: String(taskId), studentId: student.uid, studentName: student.name,
    fileName: file.name, fileUrl: `firestore://${savedFile.id}`, fileId: savedFile.id,
    explanation, status: resultStatus || 'submitted', submittedAt: serverTimestamp(),
  })
  return submissionRef.id
}
