import { useState, useEffect } from 'react'
import './index.css'
import Papa from 'papaparse'
import jsPDF from 'jspdf'

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

const generaPDF = async (proforma, noteGenerali, cliente, rappresentante) => {
  const pdf = new jsPDF()
  pdf.setFontSize(16)
  pdf.text("Proforma Ordine Campionario", 105, 20, null, null, "center")

  pdf.setFontSize(10)
  pdf.text(`Cliente: ${cliente}`, 10, 30)
  pdf.text(`Rappresentante: ${rappresentante}`, 10, 36)

  let y = 50
  let totale = 0

  for (const item of proforma) {
    const imgBase64 = await loadImageBase64(item.immagine)
    pdf.addImage(imgBase64, 'JPEG', 10, y, 30, 30)
    pdf.setFontSize(10)
    pdf.text(`Codice: ${item.codice}`, 45, y + 5)
    pdf.text(`Prezzo: € ${formatPrezzo(item.prezzo)}`, 45, y + 15)
    pdf.text(`Descrizione: ${item.descrizione || ''}`, 45, y + 25)
    if (item.nota) pdf.text(`Nota: ${item.nota}`, 45, y + 35)
    totale += parseFloat(item.prezzo.toString().replace(",", "."))
    y += item.nota ? 50 : 40

    if (y > 250) {
      pdf.addPage()
      y = 20
    }
  }

  pdf.setFontSize(12)
  pdf.text(`Totale: € ${totale.toFixed(2)}`, 140, y + 10)

  if (noteGenerali) {
    y += 20
    pdf.setFontSize(10)
    pdf.text("Note generali:", 10, y)
    pdf.text(noteGenerali, 10, y + 10)
  }

  pdf.save("proforma.pdf")
}

function App() {
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

  useEffect(() => {
    Papa.parse('https://docs.google.com/spreadsheets/d/e/2PACX-1vTcR6bZ3XeX-6tzjcoWpCws6k0QeJNdkaYJ8Q_IaJNkXUP3kWF75gSC51BK6hcJfloRWtMxD239ZCSq/pub?output=csv', {
      download: true,
      header: true,
      complete: (results) => {
        setArticoli(results.data)
      }
    })
  }, [])

  useEffect(() => {
    localStorage.setItem('proforma', JSON.stringify(proforma))
  }, [proforma])

  const cercaArticolo = () => {
    const trovati = articoli.filter(a => a.codice.toLowerCase().startsWith(codice.toLowerCase()))
    if (trovati.length === 0) {
      alert("Nessun articolo trovato. Controlla il codice inserito.")
    }
    setArticoliTrovati(trovati)
  }

  const aggiungiAProforma = (item) => {
    setProforma([...proforma, { ...item, nota: "" }])
  }

  const mostraMenuRimozione = (index) => {
    const conferma = window.confirm("Vuoi rimuovere questo articolo dalla proforma?")
    if (conferma) rimuoviDaProforma(index)
  }

  const rimuoviDaProforma = (index) => {
    const nuovaLista = [...proforma]
    nuovaLista.splice(index, 1)
    setProforma(nuovaLista)
  }

  const aggiornaNota = (index, testo) => {
    const nuovaLista = [...proforma]
    nuovaLista[index].nota = testo
    setProforma(nuovaLista)
  }

  return (
    <div className="container">
      <h1>Campionario</h1>

      <input type="text" placeholder="Cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />
      <input type="text" placeholder="Rappresentante" value={rappresentante} onChange={(e) => setRappresentante(e.target.value)} />

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Codice articolo"
          value={codice}
          onChange={(e) => setCodice(e.target.value)}
          style={{ flexGrow: 1 }}
        />
        <button onClick={cercaArticolo}>Cerca</button>
      </div>

      {articoliTrovati.length > 0 && (
        <div className="risultati">
          <h2>Risultati:</h2>
          {articoliTrovati.map((art, i) => (
            <div key={i} className="scheda">
              <h3>{art.codice}</h3>
              <p>{art.descrizione}</p>
              <img
                src={art.immagine}
                alt={art.codice}
                style={{ maxWidth: '200px', cursor: 'zoom-in' }}
                onClick={() => setPopupImg(art.immagine)}
              />
              <p>€ {formatPrezzo(art.prezzo)}</p>
              <button onClick={() => aggiungiAProforma(art)}>Aggiungi</button>
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
                  <img
                    src={item.immagine}
                    alt={item.codice}
                    className="thumb"
                    onClick={() => setPopupImg(item.immagine)}
                  />
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
            style={{ width: '100%', marginTop: '10px' }}
          ></textarea>
          <button onClick={() => generaPDF(proforma, noteGenerali, cliente, rappresentante)} style={{ marginTop: '10px' }}>
            Esporta PDF
          </button>
        </div>
      )}
    </div>
  )
}

export default App
