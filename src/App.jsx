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
  const [previewSrc, setPreviewSrc] = useState(null)

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

  const generaPDF = async (proforma, noteGenerali, cliente, rappresentante, reset = false) => {
    const pdf = new jsPDF()

    const logoPath = '/logoEM.jpg'
    const logoBase64 = await loadImageBase64(logoPath)
    const logoImg = new Image()
    logoImg.src = logoPath
    await new Promise(res => (logoImg.onload = res))
    const logoRatio = logoImg.height / logoImg.width
    const logoW = 40
    const logoH = logoW * logoRatio
    pdf.addImage(logoBase64, 'JPEG', 10, 5, logoW, logoH)

    pdf.setFontSize(16)
    pdf.text("Proforma Ordine Campionario", 105, 20, null, null, "center")

    pdf.setFontSize(10)
    pdf.text(`Cliente: ${cliente}`, 10, 30)
    pdf.text(`Rappresentante: ${rappresentante}`, 10, 36)

    let y = 45
    let totale = 0

    for (const item of proforma) {
      const imgBase64 = await loadImageBase64(item.immagine)
      const img = new Image()
      img.src = item.immagine
      await new Promise(res => (img.onload = res))

      const rowHeight = 26
      const col = {
        img: { x: 10, w: 30 },
        codice: { x: 40, w: 40 },
        prezzo: { x: 80, w: 30 },
        descrizione: { x: 110, w: 50 },
        nota: { x: 160, w: 40 }
      }

      Object.values(col).forEach(c => {
        pdf.rect(c.x, y, c.w, rowHeight)
      })

      const imgW = col.img.w - 4
      const ratio = img.height / img.width
      const imgH = imgW * ratio
      const imgY = y + (rowHeight - imgH) / 2
      pdf.addImage(imgBase64, 'JPEG', col.img.x + 2, imgY, imgW, imgH)

      pdf.setFontSize(9)
      pdf.text(item.codice, col.codice.x + col.codice.w / 2, y + 15, { align: "center" })
      pdf.text(`€ ${formatPrezzo(item.prezzo)}`, col.prezzo.x + col.prezzo.w / 2, y + 15, { align: "center" })
      pdf.text(item.descrizione || '', col.descrizione.x + col.descrizione.w / 2, y + 15, { align: "center", maxWidth: col.descrizione.w - 4 })
      if (item.nota) {
        pdf.text(item.nota, col.nota.x + col.nota.w / 2, y + 15, { align: "center", maxWidth: col.nota.w - 4 })
      }

      totale += parseFloat(item.prezzo.toString().replace(",", "."))
      y += rowHeight + 2

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

    if (reset) {
      pdf.save("proforma.pdf")
      resetProforma()
    } else {
      const blob = pdf.output('blob')
      const blobUrl = URL.createObjectURL(blob)
      setPreviewSrc(blobUrl)
    }
  }

  return (
    <div className="container">
      <h1>Campionario</h1>

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
              <h3>{art.codice}</h3>
              <p>{art.descrizione}</p>
              <img src={art.immagine} alt={art.codice} onClick={() => setPopupImg(art.immagine)} />
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

      {previewSrc && (
        <div className="popup" onClick={() => setPreviewSrc(null)}>
          <iframe src={previewSrc} title="Anteprima PDF" style={{ width: '90%', height: '90%', border: 'none', borderRadius: '6px' }} />
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
                <textarea placeholder="Nota su questo articolo..." value={item.nota || ''} onChange={(e) => aggiornaNota(i, e.target.value)}></textarea>
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
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-pdf" onClick={() => generaPDF(proforma, noteGenerali, cliente, rappresentante)}>Anteprima</button>
            <button className="btn-pdf" onClick={() => generaPDF(proforma, noteGenerali, cliente, rappresentante, true)}>Esporta PDF</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
