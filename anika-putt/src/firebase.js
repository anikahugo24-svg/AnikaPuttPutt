import { initializeApp } from 'firebase/app'
import { getDatabase }   from 'firebase/database'

const firebaseConfig = {
  apiKey:            "AIzaSyBa7yy-Lqq9Nq9WygnyBYCDyfdJdLRHJNk",
  authDomain:        "anika-braai-putt.firebaseapp.com",
  databaseURL:       "https://anika-braai-putt-default-rtdb.firebaseio.com",
  projectId:         "anika-braai-putt",
  storageBucket:     "anika-braai-putt.firebasestorage.app",
  messagingSenderId: "756522729323",
  appId:             "1:756522729323:web:2d90e40cdb05949b36562e",
}

const app = initializeApp(firebaseConfig)
export const db = getDatabase(app)
