import { useState, useEffect } from 'react'
import './index.css'
import Papa from 'papaparse'
import jsPDF from 'jspdf'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

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
    return {
      base64: src,
      width: 1,
      height: 1
    }
  }
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
    const giàInserito = proforma.some(p => p.codice === item.codice)
    if (giàInserito) {
      toast.warning(`⚠️ L'articolo ${item.codice} è già nella proforma`, {
        position: "top-right",
        autoClose: 3000
      })
      return
    }

    setProforma([...proforma, { ...item, nota: "" }])
    toast.success(`✅ Articolo ${item.codice} aggiunto con successo`, {
      position: "top-right",
      autoClose: 2000
    })
  }

  const mostraMenuRimozione = (index) => {
    toast(
      ({ closeToast }) => (
        <div className="toast-conferma-rimozione">
          <p>Vuoi rimuovere questo articolo dalla proforma?</p>
          <div className="toast-bottoni">
            <button className="btn-rimuovi" onClick={() => {
              rimuoviDaProforma(index)
              closeToast()
              toast.info("🗑️ Articolo rimosso dalla proforma", {
                position: "top-right",
                autoClose: 2000
              })
            }}>Rimuovi</button>
            <button className="btn-annulla" onClick={closeToast}>Annulla</button>
          </div>
        </div>
      ),
      {
        position: "top-center",
        autoClose: false,
        closeOnClick: false,
        closeButton: false,
        draggable: false
      }
    )
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
    setCliente("")
    setRappresentante("")
    localStorage.removeItem("proforma")
  }

  const generaPDF = async (proforma, noteGenerali, cliente, rappresentante, mode = 'preview') => {
    const pdf = new jsPDF()

    const logoPath = '/logoEM.jpg'
    const logoBase64 = await loadImageBase64(logoPath)

    const logoImg = new Image()
    logoImg.src = logoPath
    await new Promise(res => (logoImg.onload = res))

    const logoW = 40
    const logoH = logoW * (logoImg.height / logoImg.width)
    pdf.addImage(logoBase64, 'JPEG', 10, 5, logoW, logoH)

    pdf.setFontSize(16)
    pdf.text("Proforma Ordine Campionario", 105, 20, null, null, "center")
    pdf.setFontSize(10)
    pdf.text(`Cliente: ${cliente}`, 10, 30)
    pdf.text(`Rappresentante: ${rappresentante}`, 10, 36)

    let y = 45
    let totale = 0

    for (const item of proforma) {
      const { base64, width, height } = await resizeImageSafe(item.immagine)

      const rowHeight = 26
      const col = {
        img: { x: 10, w: 30 },
        codice: { x: 40, w: 40 },
        prezzo: { x: 80, w: 30 },
        descrizione: { x: 110, w: 50 },
        nota: { x: 160, w: 40 }
      }

      Object.values(col).forEach(c => pdf.rect(c.x, y, c.w, rowHeight))

      const imgW = col.img.w - 4
      const imgH = imgW * (height / width)
      const imgY = y + (rowHeight - imgH) / 2
      pdf.addImage(base64, 'JPEG', col.img.x + 2, imgY, imgW, imgH)

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

    if (mode === 'export') {
      const nomeFile = cliente
        ? `proforma-${cliente.toLowerCase().replace(/\s+/g, '_').replace(/[^\w\-]/g, '')}.pdf`
        : 'proforma-senza-nome.pdf'
      pdf.save(nomeFile)
      resetProforma()
      window.location.reload()
    } else {
      const blob = pdf.output('blob')
      const blobUrl = URL.createObjectURL(blob)
      window.open(blobUrl, '_blank')
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
  
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button className="btn-pdf" onClick={() => generaPDF(proforma, noteGenerali, cliente, rappresentante, 'preview')}>Anteprima</button>
            <button className="btn-pdf" onClick={() => generaPDF(proforma, noteGenerali, cliente, rappresentante, 'export')}>Esporta PDF</button>
            <button className="btn-pdf" onClick={() => {
              toast(
                ({ closeToast }) => (
                  <div className="toast-conferma-rimozione">
                    <p>Vuoi svuotare tutta la proforma?</p>
                    <div className="toast-bottoni">
                      <button className="btn-rimuovi" onClick={() => {
                        resetProforma()
                        closeToast()
                        toast.info("🧹 Proforma svuotata", {
                          position: "top-right",
                          autoClose: 2000
                        })
                      }}>
                        Sì
                      </button>
                      <button className="btn-annulla" onClick={closeToast}>No</button>
                    </div>
                  </div>
                ),
                {
                  position: "top-center",
                  autoClose: false,
                  closeOnClick: false,
                  closeButton: false,
                  draggable: false
                }
              )
            }}>
              Pulisci tutto
            </button>
          </div>
        </div>
      )}
  
      <ToastContainer />
    </div>
  )
  
}

export default App
