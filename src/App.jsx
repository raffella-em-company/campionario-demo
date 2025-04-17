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
          <img src={articolo.immagine} alt={articolo.nome} style={{ maxWidth: '200px' }} />
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
        </div>
      )}
    </div>
  )
}

export default App
