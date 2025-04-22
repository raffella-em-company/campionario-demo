// src/App.js
import React, { useState, useEffect } from 'react';
import './index.css';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FaFilePdf, FaPlus, FaTrash } from 'react-icons/fa';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase-config';

const formatPrezzo = (val) => {
  const parsed = parseFloat((val || '0').toString().replace(',', '.'));
  return isNaN(parsed) ? '0.00' : parsed.toFixed(2);
};

const loadImageBase64 = async (url) => {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
};

const resizeImageSafe = async (src, maxWidth = 150) => {
  try {
    const res = await fetch(src, { mode: 'cors' });
    const blob = await res.blob();
    const objectURL = URL.createObjectURL(blob);
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = objectURL;
    await new Promise(r => img.onload = r);
    const canvas = document.createElement('canvas');
    const scale = maxWidth / img.width;
    canvas.width = maxWidth;
    canvas.height = img.height * scale;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'low';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { base64: canvas.toDataURL('image/jpeg', 0.4), width: img.width, height: img.height };
  } catch (e) {
    console.warn('resizeImageSafe error', e);
    return { base64: src, width: 1, height: 1 };
  }
};

function App() {
  // --- Stato e persistenza ---
  const saved = JSON.parse(localStorage.getItem('appState') || '{}');
  const [articoli, setArticoli] = useState([]);
  const [articoliTrovati, setArticoliTrovati] = useState([]);
  const [codice, setCodice] = useState('');
  const [proforma, setProforma] = useState(saved.proforma || []);
  const [cliente, setCliente] = useState(saved.cliente || '');
  const [rappresentante, setRappresentante] = useState(saved.rappresentante || '');
  const [noteGenerali, setNoteGenerali] = useState(saved.noteGenerali || '');
  const [popupImg, setPopupImg] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // salva tutto insieme
  useEffect(() => {
    localStorage.setItem('appState', JSON.stringify({
      proforma, cliente, rappresentante, noteGenerali
    }));
  }, [proforma, cliente, rappresentante, noteGenerali]);

  // --- Caricamento CSV ---
  useEffect(() => {
    const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTcR6bZ3XeX-6tzjcoWpCws6k0QeJNdkaYJ8Q_IaJNkXUP3kWF75gSC51BK6hcJfloRWtMxD239ZCSq/pubhtml';
    Papa.parse(csvUrl, {
      download: true,
      header: true,
      complete: ({ data }) => {
        // scarta righe senza Codice e mappa i campi
        const mapped = data
          .filter(r => r.Codice && r.Codice.trim() !== '')
          .map(r => ({
            codice: r.Codice,
            descrizione: r.Descrizione,
            unitaMisura: r['Unità di misura'],
            moq: r['M.O.Q.'],
            prezzoCampione: r['Prezzo Campione'],
            prezzoProduzione: r['Prezzo Produzione'],
            immagine: r.Immagine
          }));
        setArticoli(mapped);
      },
      error: (err) => {
        toast.error('Errore caricamento articoli: ' + err.message, { position: 'top-right' });
      }
    });
  }, []);

  // --- Autenticazione Google ---
  const provider = new GoogleAuthProvider();
  const [user, setUser] = useState(null);
  const loginGoogle = async () => {
    try { await signInWithPopup(auth, provider); }
    catch (e) { toast.error('Login fallito: ' + e.message, { position: 'top-right' }); }
  };
  const logout = () => signOut(auth);
  useEffect(() => onAuthStateChanged(auth, u => setUser(u)), []);

  // --- Funzioni di ricerca e proforma ---
  const cercaArticolo = () => {
    const term = codice.trim().toLowerCase();
    const trovati = articoli.filter(a =>
      (a.codice || '').toLowerCase().includes(term)
    );
    if (trovati.length === 0) {
      toast.info('Nessun articolo trovato.', { position: 'top-right' });
    }
    setArticoliTrovati(trovati);
  };

  const aggiungiAProforma = (item) => {
    if (proforma.some(p => p.codice === item.codice)) {
      toast.warning(`Già presente: ${item.codice}`, { position: 'top-right' });
      return;
    }
    setProforma([...proforma, { ...item, nota: '' }]);
    toast.success(`Aggiunto: ${item.codice}`, { position: 'top-right' });
  };

  const rimuoviDaProforma = (i) => {
    const arr = [...proforma]; arr.splice(i, 1);
    setProforma(arr);
    toast.info('Articolo rimosso', { position: 'top-right' });
  };

  const aggiornaNota = (i, testo) => {
    const arr = [...proforma]; arr[i].nota = testo;
    setProforma(arr);
  };

  const resetProforma = () => {
    setProforma([]); setCliente(''); setRappresentante(''); setNoteGenerali('');
    toast.info('Proforma svuotata', { position: 'top-right' });
  };

  // --- Generazione PDF multi‑pagina ---
  const generaPDF = async () => {
    setIsLoading(true);
    try {
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
      // logo
      const logo64 = await loadImageBase64('/logoEM.jpg');
      const img = new Image(); img.src = '/logoEM.jpg';
      await new Promise(r => img.onload = r);
      const logoW = 40, logoH = logoW * (img.height / img.width);

      const cols = [
        { key: 'img', label: '', x: 10, w: 20 },
        { key: 'codice', label: 'Codice', x: 32, w: 25 },
        { key: 'descrizione', label: 'Descrizione', x: 57, w: 50 },
        { key: 'unitaMisura', label: 'U.M.', x: 109, w: 15 },
        { key: 'moq', label: 'M.O.Q.', x: 124, w: 15 },
        { key: 'prezzoCampione', label: 'Prezzo C.', x: 139, w: 20 },
        { key: 'prezzoProduzione', label: 'Prezzo P.', x: 161, w: 20 },
        { key: 'nota', label: 'Nota', x: 183, w: 25 },
      ];
      const rowH = 12;
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();

      const drawHeader = () => {
        pdf.addImage(logo64, 'JPEG', 10, 5, logoW, logoH);
        pdf.setFontSize(16);
        pdf.text('Proforma Ordine Campionario', pw / 2, 20, { align: 'center' });
        pdf.setFontSize(10);
        pdf.text(`Cliente: ${cliente}`, 10, 30);
        pdf.text(`Rappresentante: ${rappresentante}`, 10, 36);
      };

      const drawTableHeader = (y) => {
        pdf.setFontSize(8);
        cols.forEach(c => {
          pdf.rect(c.x, y, c.w, rowH);
          pdf.text(c.label, c.x + c.w/2, y + rowH/2 + 2, { align: 'center' });
        });
      };

      let y = 45, totale = 0;
      drawHeader();
      drawTableHeader(y);
      y += rowH;

      for (const it of proforma) {
        if (y + rowH > ph - 20) {
          pdf.addPage();
          y = 20;
          drawHeader();
          drawTableHeader(y);
          y += rowH;
        }
        // immagine
        const { base64, width, height } = await resizeImageSafe(it.immagine);
        let iw = cols[0].w - 2, ih = (iw * height) / width;
        if (ih > rowH - 2) {
          ih = rowH - 2;
          iw = (ih * width) / height;
        }
        pdf.addImage(base64, 'JPEG', cols[0].x + 1, y + 1 + ((rowH - 2) - ih)/2, iw, ih);

        pdf.setFontSize(8);
        pdf.text(it.codice, cols[1].x+cols[1].w/2, y + rowH/2 + 2, { align: 'center' });
        pdf.text(pdf.splitTextToSize(it.descrizione, cols[2].w-2), cols[2].x+1, y+4);
        pdf.text(it.unitaMisura, cols[3].x+cols[3].w/2, y + rowH/2 + 2, { align: 'center' });
        pdf.text(it.moq,       cols[4].x+cols[4].w/2, y + rowH/2 + 2, { align: 'center' });
        pdf.text(`€ ${formatPrezzo(it.prezzoCampione)}`,   cols[5].x+cols[5].w/2, y + rowH/2 + 2, { align: 'center' });
        pdf.text(`€ ${formatPrezzo(it.prezzoProduzione)}`, cols[6].x+cols[6].w/2, y + rowH/2 + 2, { align: 'center' });
        if (it.nota) {
          pdf.text(pdf.splitTextToSize(it.nota, cols[7].w-2), cols[7].x+1, y+4);
        }

        totale += parseFloat(it.prezzoCampione.toString().replace(',', '.'));
        y += rowH;
      }

      // totale & note generali
      if (y + 10 > ph - 20) { pdf.addPage(); y = 20; drawHeader(); }
      pdf.setFontSize(12);
      pdf.text(`Totale: € ${totale.toFixed(2)}`, pw - 10, y+5, { align: 'right' });
      if (noteGenerali) {
        y += 10;
        pdf.setFontSize(10);
        pdf.text('Note generali:', 10, y+5);
        pdf.text(pdf.splitTextToSize(noteGenerali, pw-20), 10, y+10);
      }

      // salva
      const safeName = cliente
        ? `proforma-${cliente.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').replace(/[^\w\-]/g, '')}.pdf`
        : 'proforma-senza-nome.pdf';
      pdf.save(safeName);

    } catch (e) {
      console.error(e);
      toast.error('Errore generazione PDF', { position: 'top-right' });
    } finally {
      setIsLoading(false);
    }
  };

  // conferma rimozione singola
  const confermaRimuovi = (i) => {
    toast(({ closeToast }) => (
      <div className="toast-conferma-rimozione">
        <p>Rimuovere questo articolo?</p>
        <div className="toast-bottoni">
          <button className="btn-rimuovi" onClick={() => { rimuoviDaProforma(i); closeToast(); }}>Sì</button>
          <button className="btn-annulla" onClick={closeToast}>No</button>
        </div>
      </div>
    ), { position: 'top-center', autoClose: false, closeButton: false });
  };

  return (
    <>
      <ToastContainer />
      {!user ? (
        <div className="login-container">
          <button onClick={loginGoogle} className="btn-login">Login con Google</button>
        </div>
      ) : (
        <>
          {isLoading && <div className="loader-pdf">Generazione PDF...</div>}
          <div className="container">
            <h1>Campionario</h1>
            <p className="welcome">Benvenutə, {user.displayName}</p>
            <button onClick={logout} className="btn-logout">Logout</button>

            <div className="clienti-inputs">
              <input type="text" placeholder="Cliente" value={cliente} onChange={e => setCliente(e.target.value)} />
              <input type="text" placeholder="Rappresentante" value={rappresentante} onChange={e => setRappresentante(e.target.value)} />
            </div>

            <div className="search-bar">
              <input type="text" placeholder="Codice articolo" value={codice} onChange={e => setCodice(e.target.value)} />
              <button onClick={cercaArticolo}>Cerca</button>
            </div>

            {articoliTrovati.length > 0 && (
              <div className="risultati">
                <h2>Risultati</h2>
                {articoliTrovati.map(art => (
                  <div key={art.codice} className="scheda">
                    <h3>{art.codice}</h3>
                    <p>{art.descrizione}</p>
                    <p>U.M.: {art.unitaMisura}</p>
                    <p>MOQ: {art.moq}</p>
                    <p>Campione: € {formatPrezzo(art.prezzoCampione)}</p>
                    <p>Produzione: € {formatPrezzo(art.prezzoProduzione)}</p>
                    <img src={art.immagine} alt={art.codice} onClick={() => setPopupImg(art.immagine)} />
                    <button className="btn-add" onClick={() => aggiungiAProforma(art)}><FaPlus /></button>
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
                  {proforma.map((it, i) => (
                    <li
                      key={it.codice}
                      onContextMenu={e => { e.preventDefault(); confermaRimuovi(i); }}
                    >
                      <div className="info">
                        <img src={it.immagine} alt={it.codice} className="thumb" onClick={() => setPopupImg(it.immagine)} />
                        <span>{it.codice}</span>
                        <span>Camp.: € {formatPrezzo(it.prezzoCampione)}</span>
                        <span>Prod.: € {formatPrezzo(it.prezzoProduzione)}</span>
                      </div>
                      <textarea
                        placeholder="Nota su questo articolo..."
                        value={it.nota}
                        onChange={e => aggiornaNota(i, e.target.value)}
                      />
                    </li>
                  ))}
                </ul>

                <textarea
                  placeholder="Note generali..."
                  className="note-generali"
                  rows={3}
                  value={noteGenerali}
                  onChange={e => setNoteGenerali(e.target.value)}
                />

                <div className="bottoni-proforma">
                  <button className="btn-icon" onClick={generaPDF}><FaFilePdf /></button>
                  <button className="btn-icon btn-danger" onClick={() => confermaRimuovi('all')}>
                    <FaTrash />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

export default App;
