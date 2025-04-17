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

const generaPDF = async (proforma, noteGenerali, cliente, rappresentante, resetProforma) => {
  const pdf = new jsPDF()

  const logo = await loadImageBase64('/logoEM.jpg')
  pdf.addImage(logo, 'JPEG', 10, 5, 40, 12)

  pdf.setFontSize(16)
  pdf.text("Proforma Ordine Campionario", 105, 20, null, null, "center")

  pdf.setFontSize(10)
  pdf.text(`Cliente: ${cliente}`, 10, 30)
  pdf.text(`Rappresentante: ${rappresentante}`, 10, 36)

  let y = 45
  let totale = 0

  for (const item of proforma) {
    const imgBase64 = await loadImageBase64(item.immagine)

    const imgW = 20
    const imgH = 20
    pdf.setDrawColor(0)
    pdf.setLineWidth(0.1)
    pdf.rect(10, y, 190, 25)

    pdf.addImage(imgBase64, 'JPEG', 12, y + 2, imgW, imgH)

    // celle stile excel
    pdf.rect(35, y, 45, 25)
    pdf.rect(80, y, 30, 25)
    pdf.rect(110, y, 45, 25)
    pdf.rect(155, y, 45, 25)

    pdf.text(item.codice, 36, y + 10)
    pdf.text(`€ ${formatPrezzo(item.prezzo)}`, 81, y + 10)
    pdf.text(item.descrizione || '', 111, y + 10)
    if (item.nota) pdf.text(item.nota, 156, y + 10)

    totale += parseFloat(item.prezzo.toString().replace(",", "."))
    y += 27

    if (y > 260) {
      pdf.addPage()
      y = 20
    }
  }

  pdf.setFontSize(12)
  pdf.text(`Totale: € ${totale.toFixed(2)}`, 150, y + 5)

  if (noteGenerali) {
    y += 15
    pdf.setFontSize(10)
    pdf.text("Note generali:", 10, y)
    pdf.text(noteGenerali, 10, y + 6)
  }

  pdf.save("proforma.pdf")
  resetProforma()
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
    if (trovati.length === 0) alert("Nessun articolo trovato. Controlla il codice inserito.")
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

  const resetProforma = () => {
    setProforma([])
    setNoteGenerali("")
    localStorage.removeItem("proforma")
  }

  return (
    <div className="container">
      <h1>Campionario</h1>

      <input type="text" placeholder="Cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />
      <input type="text" placeholder="Rappresentante" value={rappresentante} onChange={(e) => setRappresentante(e.target.value)} />

      <div className="search-bar">
        <input
          type="text"
          placeholder="Codice articolo"
          value={codice}
          onChange={(e) => setCodice(e.target.value)}
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
            className="note-generali"
          ></textarea>
          <button
            className="btn-pdf"
            onClick={() => generaPDF(proforma, noteGenerali, cliente, rappresentante, resetProforma)}
          >
            Esporta PDF
          </button>
        </div>
      )}
    </div>
  )
}

export default App
