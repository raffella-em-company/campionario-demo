import { useState, useEffect } from 'react'
import './index.css'
import Papa from 'papaparse'
import jsPDF from 'jspdf'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { FaFilePdf, FaPlus, FaTrash } from "react-icons/fa"
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "firebase/auth"
import { auth } from './firebase-config'

const formatPrezzo = (val) => {
  const parsed = parseFloat((val || '0').toString().replace(',', '.'))
  return isNaN(parsed) ? '0.00' : parsed.toFixed(2)
}

const loadImageBase64 = async (url) => {
  const res = await fetch(url)
  const blob = await res.blob()
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.readAsDataURL(blob)
  })
}

const resizeImageSafe = async (src, maxWidth = 150) => {
  try {
    const res = await fetch(src, { mode: 'cors' })
    const blob = await res.blob()
    const objectURL = URL.createObjectURL(blob)
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.src = objectURL
    await new Promise(resolve => (img.onload = resolve))
    const canvas = document.createElement('canvas')
    const scale = maxWidth / img.width
    canvas.width = maxWidth
    canvas.height = img.height * scale
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'low'
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return {
      base64: canvas.toDataURL('image/jpeg', 0.4),
      width: img.width,
      height: img.height
    }
  } catch (e) {
    console.warn("Errore nel ridimensionamento sicuro", e)
    return { base64: src, width: 1, height: 1 }
  }
}

function App() {
  const provider = new GoogleAuthProvider()
  const [user, setUser] = useState(null)

  const [codice, setCodice] = useState("")
  const [articoliTrovati, setArticoliTrovati] = useState([])
  const [proforma, setProforma] = useState(() => {
    const saved = localStorage.getItem('proforma')
    return saved ? JSON.parse(saved) : []
  })
  const [noteGenerali, setNoteGenerali] = useState("")
  const [articoli, setArticoli] = useState([])
  const [cliente, setCliente] = useState("")
  const [rappresentante, setRappresentante] = useState("")
  const [popupImg, setPopupImg] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const loginGoogle = async () => {
    try {
      await signInWithPopup(auth, provider)
    } catch (error) {
      console.error("Errore login:", error)
    }
  }

  const logout = async () => {
    try {
      await signOut(auth)
      setUser(null)
      toast.info("Logout effettuato con successo", { position: "top-center" })
    } catch (err) {
      console.error("Errore nel logout:", err)
      toast.error("Errore durante il logout", { position: "top-center" })
    }
  }

  const cercaArticolo = () => {
    const trovati = articoli.filter(a => a.codice.toLowerCase().startsWith(codice.toLowerCase()))
    if (trovati.length === 0) alert("Nessun articolo trovato. Controlla il codice inserito.")
    setArticoliTrovati(trovati)
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser?.email?.endsWith('@emcompany.it')) {
        setUser(currentUser)
      } else if (currentUser) {
        signOut(auth)
        toast.error("Accesso consentito solo con email @emcompany.it", { position: "top-center" })
      } else {
        setUser(null)
      }
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    Papa.parse('https://docs.google.com/spreadsheets/d/e/2PACX-1vTcR6bZ3XeX-6tzjcoWpCws6k0QeJNdkaYJ8Q_IaJNkXUP3kWF75gSC51BK6hcJfloRWtMxD239ZCSq/pub?output=csv', {
      download: true,
      header: true,
      complete: (results) => setArticoli(results.data)
    })
  }, [])

  useEffect(() => {
    localStorage.setItem('proforma', JSON.stringify(proforma))
  }, [proforma])

  return (
    <>
      {!user ? (
        <div className="login-container">
          <button onClick={loginGoogle} className="btn-login">Login con Google</button>
        </div>
      ) : (
        <>
          {isLoading && (
            <div className="loader-pdf">Generazione PDF in corso...</div>
          )}
          <div className="container">
            <h1>Campionario</h1>
            <p className="welcome">Benvenutə, {user.displayName}</p>
            <button onClick={logout} className="btn-logout">Logout</button>

            {/* Input cliente e rappresentante */}
            <input type="text" placeholder="Cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />
            <input type="text" placeholder="Rappresentante" value={rappresentante} onChange={(e) => setRappresentante(e.target.value)} />

            {/* Ricerca articolo */}
            <div className="search-bar">
              <input type="text" placeholder="Codice articolo" value={codice} onChange={(e) => setCodice(e.target.value)} />
              <button onClick={cercaArticolo}>Cerca</button>
            </div>

            {/* Lista risultati */}
            {articoliTrovati.length > 0 && (
              <div className="risultati">
                <h2>Risultati:</h2>
                {articoliTrovati.map((art, i) => (
                  <div key={i} className="scheda">
                    <h3>{art.codice}</h3>
                    <p>{art.descrizione}</p>
                    <img src={art.immagine} alt={art.codice} onClick={() => setPopupImg(art.immagine)} />
                    <p>€ {formatPrezzo(art.prezzo)}</p>
                    <button className="btn-add" onClick={() => aggiungiAProforma(art)}>
                      <FaPlus />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {popupImg && (
              <div className="popup" onClick={() => setPopupImg(null)}>
                <img src={popupImg} alt="Zoom" />
              </div>
            )}

            {proforma.length > 0 && (
              <div className="proforma">
                <h3>Proforma</h3>
                <ul>
                  {proforma.map((item, i) => (
                    <li key={i} onContextMenu={(e) => { e.preventDefault(); mostraMenuRimozione(i) }}>
                      <div className="info">
                        <img src={item.immagine} alt={item.codice} className="thumb" onClick={() => setPopupImg(item.immagine)} />
                        <span>{item.codice} - € {formatPrezzo(item.prezzo)}</span>
                      </div>
                      <textarea
                        placeholder="Nota su questo articolo..."
                        value={item.nota || ''}
                        onChange={(e) => aggiornaNota(i, e.target.value)}
                      ></textarea>
                    </li>
                  ))}
                </ul>
                <textarea
                  placeholder="Note generali..."
                  value={noteGenerali}
                  onChange={(e) => setNoteGenerali(e.target.value)}
                  rows={3}
                  className="note-generali"
                ></textarea>
                <div className="bottoni-proforma">
                  <button className="btn-icon" onClick={() => generaPDF(proforma, noteGenerali, cliente, rappresentante)}>
                    <FaFilePdf />
                  </button>
                  <button className="btn-icon btn-danger" onClick={() => {
                    if (proforma.length === 0) return
                    toast(({ closeToast }) => (
                      <div className="toast-conferma-rimozione">
                        <p>Vuoi svuotare tutta la proforma?</p>
                        <div className="toast-bottoni">
                          <button className="btn-rimuovi" onClick={() => {
                            resetProforma()
                            closeToast()
                            toast.info("🧹 Proforma svuotata", { position: "top-right", autoClose: 2000 })
                          }}>
                            Sì
                          </button>
                          <button className="btn-annulla" onClick={closeToast}>No</button>
                        </div>
                      </div>
                    ), {
                      position: "top-center",
                      autoClose: false,
                      closeOnClick: false,
                      closeButton: false,
                      draggable: false,
                    })
                  }}>
                    <FaTrash />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
      <ToastContainer />
    </>
  )
}

export default App