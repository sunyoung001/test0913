import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import {
  addDoc, collection, doc, getFirestore, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore'
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage'

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
export const storage = app ? getStorage(app) : null

export async function ensureSession(role, name) {
  if (!firebaseReady) return null
  const credential = auth.currentUser ? { user: auth.currentUser } : await signInWithPopup(auth, new GoogleAuthProvider())
  await setDoc(doc(db, 'users', credential.user.uid), {
    name: credential.user.displayName || name,
    email: credential.user.email,
    lastSelectedScreen: role,
    updatedAt: serverTimestamp(),
  }, { merge: true })
  return credential.user
}

export function listenTasks(callback, onError) {
  if (!firebaseReady) return () => {}
  return onSnapshot(query(collection(db, 'tasks'), orderBy('createdAt', 'desc')), snapshot => {
    callback(snapshot.docs.map(item => ({ id: item.id, ...item.data() })))
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
    const fileRef = ref(storage, `answers/${taskRef.id}/${Date.now()}-${answerFile.name}`)
    await uploadBytes(fileRef, answerFile)
    answerFileUrl = await getDownloadURL(fileRef)
    answerFileName = answerFile.name
  }
  const data = { title, classNames, deadline, description, criteria, hint, answerFileUrl, answerFileName, updatedAt: serverTimestamp() }
  if (task?.id) await updateDoc(taskRef, data)
  else await setDoc(taskRef, { ...data, subject: '블록 프로그래밍', status: 'todo', attempts: 0, createdAt: serverTimestamp() })
  return taskRef.id
}

export async function submitEntry({ taskId, file, explanation, student }) {
  const submissionRef = doc(collection(db, 'submissions'))
  const fileRef = ref(storage, `submissions/${taskId}/${student.uid}/${Date.now()}-${file.name}`)
  await uploadBytes(fileRef, file, { contentType: file.type || 'application/octet-stream' })
  const fileUrl = await getDownloadURL(fileRef)
  await setDoc(submissionRef, {
    taskId: String(taskId), studentId: student.uid, studentName: student.name,
    fileName: file.name, fileUrl, explanation, status: 'submitted', submittedAt: serverTimestamp(),
  })
  return submissionRef.id
}
