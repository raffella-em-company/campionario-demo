import { useState } from 'react'
import './index.css'
import { articoliDemo } from './articoli'

function App() {
  const [codice, setCodice] = useState("")
  const [articolo, setArticolo] = useState(null)
  const [proforma, setProforma] = useState([])

  const cercaArticolo = () => {
    const trovato = articoliDemo.find(a => a.codice.toLowerCase() === codice.toLowerCase())
    setArticolo(trovato || null)
  }

  const aggiungiAProforma = (variante) => {
    setProforma([...proforma, { articolo: articolo.nome, variante }])
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
          {articolo.varianti.map((v, i) => (
            <div key={i} className="variante">
              <img src={v.immagine} alt={v.nome} />
              <p>{v.nome} - € {v.prezzo.toFixed(2)}</p>
              <button onClick={() => aggiungiAProforma(v)}>Aggiungi</button>
            </div>
          ))}
        </div>
      )}

      {proforma.length > 0 && (
        <div className="proforma">
          <h3>Proforma</h3>
          <ul>
            {proforma.map((item, i) => (
              <li key={i}>{item.articolo} - {item.variante.nome} (€ {item.variante.prezzo.toFixed(2)})</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default App
