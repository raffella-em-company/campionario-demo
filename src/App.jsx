import { useState, useEffect } from 'react'
import './index.css'
import Papa from 'papaparse'
import jsPDF from 'jspdf'

// --- Utilità
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

const generaPDF = async (proforma, note) => {
  const pdf = new jsPDF()
  pdf.setFontSize(16)
  pdf.text("Proforma Ordine Campionario", 105, 20, null, null, "center")
  let y = 30
  let totale = 0

  for (const item of proforma) {
    const imgBase64 = await loadImageBase64(item.immagine)
    pdf.addImage(imgBase64, 'JPEG', 10, y, 30, 30)
    pdf.setFontSize(10)
    pdf.text(`Codice: ${item.nome}`, 45, y + 5)
    pdf.text(`Prezzo: € ${formatPrezzo(item.prezzo)}`, 45, y + 15)
    pdf.text(`Descrizione: ${item.descrizione || ''}`, 45, y + 25)
    totale += parseFloat(item.prezzo.toString().replace(",", "."))
    y += 40

    if (y > 250) {
      pdf.addPage()
      y = 20
    }
  }

  // Totale
  pdf.setFontSize(12)
  pdf.text(`Totale: € ${totale.toFixed(2)}`, 140, y + 10)

  // Note
  if (note) {
    y += 20
    pdf.setFontSize(10)
    pdf.text("Note:", 10, y)
    pdf.text(note, 10, y + 10)
  }

  pdf.save("proforma.pdf")
}

// --- Componente principale
function App() {
  const [codice, setCodice] = useState("")
  const [articolo, setArticolo] = useState(null)
  const [proforma, setProforma] = useState([])
  const [articoli, setArticoli] = useState([])
  const [note, setNote] = useState("")

  useEffect(() => {
    Papa.parse('https://docs.google.com/spreadsheets/d/e/2PACX-1vTcR6bZ3XeX-6tzjcoWpCws6k0QeJNdkaYJ8Q_IaJNkXUP3kWF75gSC51BK6hcJfloRWtMxD239ZCSq/pub?output=csv', {
      download: true,
      header: true,
      complete: (results) => {
        setArticoli(results.data)
      }
    })
  }, [])

  const cercaArticolo = () => {
    const trovato = articoli.find(a =>
      a.codice.toLowerCase().startsWith(codice.toLowerCase())
    )
    setArticolo(trovato || null)
  }

  const aggiungiAProforma = () => {
    if (articolo) {
      setProforma([...proforma, articolo])
    }
  }

  const rimuoviDaProforma = (index) => {
    const nuovaLista = [...proforma]
    nuovaLista.splice(index, 1)
    setProforma(nuovaLista)
  }

  return (
    <div className="container">
      <h1>Campionario</h1>
      <input
        type="text"
        placeholder="Codice articolo"
        value={codice}
        onChange={(e) => setCodice(e.target.value)}
      />
      <button onClick={cercaArticolo}>Cerca</button>

      {articolo && (
        <div className="scheda">
          <h2>{articolo.nome}</h2>
          <p>{articolo.descrizione}</p>
          <img src={articolo.immagine} alt={articolo.nome} style={{ maxWidth: '200px' }} referrerPolicy="no-referrer" />
          <p>€ {formatPrezzo(articolo.prezzo)}</p>
          <button onClick={aggiungiAProforma}>Aggiungi</button>
        </div>
      )}

      {proforma.length > 0 && (
        <div className="proforma">
          <h3>Proforma</h3>
          <ul>
            {proforma.map((item, i) => (
              <li key={i}>
                <img
                  src={item.immagine}
                  alt={item.nome}
                  style={{ width: '50px', verticalAlign: 'middle', marginRight: '10px' }}
                />
                {item.nome} - € {formatPrezzo(item.prezzo)}
                <button
                  onClick={() => rimuoviDaProforma(i)}
                  style={{ marginLeft: '10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}
                  title="Rimuovi"
                >❌</button>
              </li>
            ))}
          </ul>

          <textarea
            placeholder="Note aggiuntive..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            style={{ width: '100%', marginTop: '10px', padding: '5px' }}
          ></textarea>

          <button onClick={() => generaPDF(proforma, note)} style={{ marginTop: '10px' }}>Esporta PDF</button>
        </div>
      )}
    </div>
  )
}

export default App
