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

function App() {
  const provider = new GoogleAuthProvider()
  const [user, setUser] = useState(null)
  const [codice, setCodice] = useState("")
  const [articoliTrovati, setArticoliTrovati] = useState([])
  const [articoli, setArticoli] = useState([])
  const [cliente, setCliente] = useState("")
  const [rappresentante, setRappresentante] = useState("")
  const [popupImg, setPopupImg] = useState(null)

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
    const trovati = articoli.filter(a => a.Codice?.toLowerCase().startsWith(codice.toLowerCase()))
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
      complete: (results) => {
        const validRows = results.data.filter(row => row.Codice)
        setArticoli(validRows)
      }
    })
  }, [])

  return (
    <>
      {!user ? (
        <div className="login-container">
          <button onClick={loginGoogle} className="btn-login">Login con Google</button>
        </div>
      ) : (
        <div className="container">
          <h1>Campionario</h1>
          <p className="welcome">Benvenutə, {user.displayName}</p>
          <button onClick={logout} className="btn-logout">Logout</button>

          <input type="text" placeholder="Cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />
          <input type="text" placeholder="Rappresentante" value={rappresentante} onChange={(e) => setRappresentante(e.target.value)} />

          <div className="search-bar">
            <input type="text" placeholder="Codice articolo" value={codice} onChange={(e) => setCodice(e.target.value)} />
            <button onClick={cercaArticolo}>Cerca</button>
          </div>

          {articoliTrovati.length > 0 && (
            <div className="risultati">
              <h2>Risultati:</h2>
              {articoliTrovati.map((art, i) => (
                <div key={i} className="scheda">
                  <h3>{art.Codice}</h3>
                  <img src={art.Immagine} alt={art.Codice} onClick={() => setPopupImg(art.Immagine)} />
                  <p><strong>Descrizione:</strong> {art.Descrizione}</p>
                  <p><strong>Unità di misura:</strong> {art["Unità di misura"]}</p>
                  <p><strong>M.O.Q.:</strong> {art["M.O.Q."]}</p>
                  <p><strong>Prezzo Campione:</strong> € {formatPrezzo(art["Prezzo Campione"])}</p>
                  <p><strong>Prezzo Produzione:</strong> € {formatPrezzo(art["Prezzo Produzione"])}</p>
                  <button className="btn-add" onClick={() => console.log("Da implementare: aggiunta a proforma")}><FaPlus /></button>
                </div>
              ))}
            </div>
          )}

          {popupImg && (
            <div className="popup" onClick={() => setPopupImg(null)}>
              <img src={popupImg} alt="Zoom" />
            </div>
          )}
        </div>
      )}
      <ToastContainer />
    </>
  )
}

export default App