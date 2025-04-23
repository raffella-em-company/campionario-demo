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
    return {
      base64: canvas.toDataURL('image/jpeg', 1.0),
      width: img.width,
      height: img.height
    };    
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
  const [banca, setBanca] = useState(saved.banca || '');
  const [corriere, setCorriere] = useState(saved.corriere || '');
  const [noteGenerali, setNoteGenerali] = useState(saved.noteGenerali || '');
  const [popupImg, setPopupImg] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem('appState', JSON.stringify({ proforma, cliente, banca, corriere, noteGenerali }));
  }, [proforma, cliente, banca, corriere, noteGenerali]);  

  // --- Caricamento CSV ---
  useEffect(() => {
    const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTcR6bZ3XeX-6tzjcoWpCws6k0QeJNdkaYJ8Q_IaJNkXUP3kWF75gSC51BK6hcJfloRWtMxD239ZCSq/pub?output=csv';
    Papa.parse(csvUrl, {
      download: true,
      header: true,
      complete: ({ data }) => {
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
      error: err => toast.error('Errore caricamento: ' + err.message, { position: 'top-right' })
    });
  }, []);

  // --- Autenticazione Google ---
  const [user, setUser] = useState(null);
  const provider = new GoogleAuthProvider();

  const loginGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email;
      if (!email.endsWith('@emcompany.it')) {
        await signOut(auth);
        toast.error('Accesso consentito solo a email @emcompany.it', { position: 'top-right' });
      }
    } catch (e) {
      toast.error('Login fallito: ' + e.message, { position: 'top-right' });
    }
  };

  const logout = () => signOut(auth);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, u => setUser(u));
    return () => unsubscribe();
  }, []);

  // --- Funzioni di ricerca e proforma ---
  const cercaArticolo = () => {
    const term = codice.trim().toLowerCase();
    const trovati = articoli.filter(a => (a.codice || '').toLowerCase().includes(term));
    if (trovati.length === 0) toast.info('Nessun articolo trovato.', { position: 'top-right' });
    setArticoliTrovati(trovati);
  };

  const aggiungiAProforma = item => {
    if (proforma.some(p => p.codice === item.codice)) {
      toast.warning(`Già presente: ${item.codice}`, { position: 'top-right' }); return;
    }
    setProforma([...proforma, { ...item, nota: '', quantita: 1 }]);
    toast.success(`Aggiunto: ${item.codice}`, { position: 'top-right' });
  };

  const rimuoviDaProforma = i => {
    const arr = [...proforma]; arr.splice(i, 1);
    setProforma(arr);
    toast.info('Articolo rimosso', { position: 'top-right' });
  };

  const aggiornaNota = (i, testo) => {
    const arr = [...proforma]; arr[i].nota = testo;
    setProforma(arr);
  };
  const aggiornaQuantita = (i, valore) => {
    const arr = [...proforma];
    arr[i].quantita = parseInt(valore) || 1;
    setProforma(arr);
  };  

  const resetProforma = () => {
    setProforma([]);
    setCliente('');
    setBanca('');
    setCorriere('');
    setNoteGenerali('');
    toast.info('Proforma svuotata', { position: 'top-right' });
  };  

    // --- Generazione PDF con header azienda e griglia Excel-style ---
    const generaPDF = async () => {
      setIsLoading(true);
      try {
        const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
        const pw = pdf.internal.pageSize.getWidth();
        const ph = pdf.internal.pageSize.getHeight();
  
        // 1) HEADER AZIENDA - solo logo
        const logo64 = await loadImageBase64('/logoEM.jpg');
        const img = new Image(); img.src = '/logoEM.jpg';
        await new Promise(r => img.onload = r);
        const logoW = 60;
        const logoH = logoW * (img.height / img.width);
        pdf.addImage(logo64, 'JPEG', 10, 5, logoW, logoH);
  
        // 2) INTESTAZIONE PROFORMA
        pdf.setFontSize(10);
        const infoStartY = logoH + 10;
        const rappresentanteNome = user.displayName || '';
        const rappresentanteEmail = user.email || '';
        pdf.text(`Cliente: ${cliente}`, 10, infoStartY);
        pdf.text(`Banca: ${banca}`, 10, infoStartY + 6);
        pdf.text(`Data: ${new Date().toLocaleDateString()}`, 10, infoStartY + 12);
        pdf.text(`Corriere: ${corriere}`, 10, infoStartY + 18);
        pdf.setFont(undefined, 'bold');
        pdf.text(`RAPPRESENTANTE:`, pw - 70, infoStartY);
        pdf.text(rappresentanteNome, pw - 70, infoStartY + 6);
        pdf.setFont(undefined, 'normal');
        pdf.text(rappresentanteEmail, pw - 70, infoStartY + 12);
  
        // 3) GRIGLIA EXCEL-STYLE
        const tableX = 10;
        const tableY = logoH + 25;
        const colW = [60, 20, 60, 15, 15, 20, 20, 15]; // immagine 60mm
        const rowH = 15;
        const maxRows = Math.floor((ph - tableY - 20) / rowH);
        const drawGrid = startY => {
          for (let r = 0; r < maxRows; r++) {
            let x = tableX;
            const yPos = startY + r * rowH;
            colW.forEach(w => { pdf.rect(x, yPos, w, rowH); x += w; });
          }
        };
        drawGrid(tableY);
  
        // 4) POPOLA RIGHE
        let y = tableY;
        let row = 0;
        for (const it of proforma) {
          if (row >= maxRows) {
            pdf.addPage();
            y = tableY;
            row = 0;
            drawGrid(tableY);
          }
          // immagine
          const { base64, width, height } = await resizeImageSafe(it.immagine, colW[0] - 2);
          let iw = colW[0] - 2;
          let ih = (iw * height) / width;
          if (ih > rowH - 2) { ih = rowH - 2; iw = (ih * width) / height; }
          pdf.addImage(base64, 'JPEG', tableX + 1, y + 1 + ((rowH - 2) - ih) / 2, iw, ih);
  
          // testi colonne
          let x = tableX + colW[0];
          pdf.setFontSize(8);
          pdf.text(it.codice, x + colW[1] / 2, y + rowH / 2 + 2, { align: 'center' });
          x += colW[1];
          pdf.text(pdf.splitTextToSize(it.descrizione, colW[2] - 2), x + 1, y + 4);
          x += colW[2];
          pdf.text(it.unitaMisura, x + colW[3] / 2, y + rowH / 2 + 2, { align: 'center' });
          x += colW[3];
          pdf.text(it.moq, x + colW[4] / 2, y + rowH / 2 + 2, { align: 'center' });
          x += colW[4];
          pdf.text(`€ ${formatPrezzo(it.prezzoCampione)}`, x + colW[5] / 2, y + rowH / 2 + 2, { align: 'center' });
          x += colW[5];
          pdf.text(`€ ${formatPrezzo(it.prezzoProduzione)}`, x + colW[6] / 2, y + rowH / 2 + 2, { align: 'center' });
  
          row++;
          y += rowH;
        }
  
        // 5) NOTE GENERALI (se presenti)
        if (noteGenerali) {
          let footerY = y + 5;
          if (footerY + 20 > ph) {
            pdf.addPage();
            footerY = 20;
          }
          pdf.setFontSize(10);
          pdf.text('Note generali:', 10, footerY);
          pdf.text(pdf.splitTextToSize(noteGenerali, pw - 20), 10, footerY + 6);
        }
  
        // salva PDF
        const name = cliente
          ? `proforma-${cliente.toLowerCase().replace(/\s+/g, '_')}.pdf`
          : 'proforma.pdf';
        pdf.save(name);
  
      } catch (e) {
        console.error(e);
        toast.error('Errore generazione PDF', { position: 'top-right' });
      } finally {
        setIsLoading(false);
      }
    };
  

  const confermaRimuovi = i => {
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
            <input type="text" placeholder="Banca" value={banca} onChange={e => setBanca(e.target.value)} />
            <input type="text" placeholder="Corriere" value={corriere} onChange={e => setCorriere(e.target.value)} />
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
                    <button className="btn-add" onClick={() => aggiungiAProforma(art)}><FaPlus/></button>
                  </div>
                ))}
              </div>
            )}

            {popupImg && (
              <div className="popup" onClick={() => setPopupImg(null)}>
                <img src={popupImg} alt="Zoom" />
              </div>
            )}

            {proforma.length>0 && (
              <div className="proforma">
                <h3>Proforma</h3>
                <ul>
                  {proforma.map((it, i) => (
                    <li key={it.codice} onContextMenu={e => { e.preventDefault(); confermaRimuovi(i); }}>
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
                      <input
                        type="number"
                        min="1"
                        className="input-quantita"
                        value={it.quantita}
                        onChange={e => aggiornaQuantita(i, e.target.value)}
                        placeholder="Quantità"
                      />
                    </li>
                  ))}
                </ul>
                <textarea placeholder="Note generali..." className="note-generali" rows={3} value={noteGenerali} onChange={e=>setNoteGenerali(e.target.value)}/>
                <div className="bottoni-proforma">
                  <button className="btn-icon" onClick={generaPDF}><FaFilePdf/></button>
                  <button className="btn-icon btn-danger" onClick={()=>resetProforma()}><FaTrash/></button>
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
