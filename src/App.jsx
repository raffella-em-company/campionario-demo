import { useState, useEffect } from 'react'
import './index.css'
import Papa from 'papaparse'

function App() {
  const [codice, setCodice] = useState("")
  const [articolo, setArticolo] = useState(null)
  const [proforma, setProforma] = useState([])
  const [articoli, setArticoli] = useState([])

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
    const trovato = articoli.find(a => a.codice.toLowerCase() === codice.toLowerCase())
    setArticolo(trovato || null)
  }

  const aggiungiAProforma = () => {
    if (articolo) {
      setProforma([...proforma, articolo])
    }
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
          <img src={articolo.immagine} alt={articolo.nome} style={{ maxWidth: '200px' }} referrerPolicy="no-referrer"/>
          <p>€ {parseFloat(articolo.prezzo).toFixed(2)}</p>
          <button onClick={aggiungiAProforma}>Aggiungi</button>
        </div>
      )}

      {proforma.length > 0 && (
        <div className="proforma">
          <h3>Proforma</h3>
          <ul>
            {proforma.map((item, i) => (
              <li key={i}>{item.nome} - € {parseFloat(item.prezzo).toFixed(2)}</li>
            ))}
          </ul>
          <button onClick={() => generaPDF(proforma)}>Esporta PDF</button>
        </div>
      )}
    </div>
  )
}

import jsPDF from 'jspdf'

// Funzione di utilità per caricare immagini da URL
const loadImageBase64 = async (url) => {
  const res = await fetch(url)
  const blob = await res.blob()
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.readAsDataURL(blob)
  })
}

// Generazione PDF con immagini
const generaPDF = async (proforma) => {
  const pdf = new jsPDF()
  pdf.setFontSize(16)
  pdf.text("Proforma Ordine Campionario", 105, 20, null, null, "center")
  let y = 30

  for (const item of proforma) {
    const imgBase64 = await loadImageBase64(item.immagine)

    pdf.addImage(imgBase64, 'JPEG', 10, y, 30, 30) // img a sinistra
    pdf.setFontSize(10)
    pdf.text(`Codice: ${item.nome}`, 45, y + 5)
    pdf.text(`Prezzo: € ${parseFloat(item.prezzo).toFixed(2)}`, 45, y + 15)
    pdf.text(`Descrizione: ${item.descrizione || ''}`, 45, y + 25)
    y += 40

    if (y > 270) {
      pdf.addPage()
      y = 20
    }
  }

  pdf.save("proforma.pdf")
}


export default App
