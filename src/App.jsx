// src/App.js
import React, { useState, useEffect } from 'react';
import './index.css';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FaFilePdf, FaPlus, FaTrash, FaArrowUp } from 'react-icons/fa';
import {signInWithPopup, signInWithRedirect, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase-config';

const formatPrezzo = val => {
  const parsed = parseFloat((val || '0').toString().replace(',', '.'));
  return isNaN(parsed) ? '0.00' : parsed.toFixed(2);
};

const loadImageBase64 = async url => {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
};

const resizeImageSafe = async src => {
  try {
    const res = await fetch(src, { mode: 'cors' });
    const blob = await res.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const useCanvas = img.width > 1500 || img.height > 1500;
          if (useCanvas) {
            const canvas = document.createElement('canvas');
            const scale = 0.3;
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'medium';
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve({
              base64: canvas.toDataURL('image/jpeg', 0.8),
              width: canvas.width,
              height: canvas.height
            });
          } else {
            resolve({
              base64: reader.result,
              width: img.width,
              height: img.height
            });
          }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('resizeImageSafe error', e);
    return { base64: src, width: 1, height: 1 };
  }
};

function App() {
  // stato e persistenza
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
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [mostraPrezzi, setMostraPrezzi] = useState(true);
  const [user, setUser] = useState(null);

  const provider = new GoogleAuthProvider();

  // salva in localStorage
  useEffect(() => {
    localStorage.setItem(
      'appState',
      JSON.stringify({ proforma, cliente, banca, corriere, noteGenerali })
    );
  }, [proforma, cliente, banca, corriere, noteGenerali]);

  // scroll-to-top
  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  const scrollToTop = () =>
    window.scrollTo({ top: 0, behavior: 'smooth' });

  // carica CSV
  useEffect(() => {
    const csvUrl =
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vTcR6bZ3XeX-6tzjcoWpCws6k0QeJNdkaYJ8Q_IaJNkXUP3kWF75gSC51BK6hcJfloRWtMxD239ZCSq/pub?output=csv';
    Papa.parse(csvUrl, {
      download: true,
      header: true,
      complete: ({ data }) => {
        const mapped = data
          .filter(r => r.Codice && r.Codice.trim())
          .map(r => ({
            codice: r['Codice'],
            descrizione: r['Descrizione'],
            unitaMisura: r['Unità di misura'],
            moqCampione: r['M.O.Q. Camp.'],
            prezzoCampione: r['Prezzo Campione'],
            moqProduzione: r['M.O.Q. Prod.'],
            prezzoProduzione: r['Prezzo Produzione'],
            immagine: r['Immagine']
          }));
        setArticoli(mapped);
      },
      error: err =>
        toast.error('Errore caricamento: ' + err.message, {
          position: 'top-right'
        })
    });
  }, []);

  // login Google
  const loginGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email;
      if (!email.endsWith('@emcompany.it')) {
        await signOut(auth);
        toast.error('Solo email @emcompany.it', {
          position: 'top-right'
        });
      }
    } catch (e) {
      if (e.code === 'auth/popup-blocked') {
        toast.info('Popup bloccato, redirect...', {
          position: 'top-right'
        });
        try {
          await signInWithRedirect(auth, provider);
        } catch (redirectErr) {
          toast.error(
            'Redirect fallito: ' + redirectErr.message,
            { position: 'top-right' }
          );
        }
      } else {
        toast.error('Login fallito: ' + e.message, {
          position: 'top-right'
        });
      }
    }
  };
  const logout = () => signOut(auth);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, u => setUser(u));
    return () => unsubscribe();
  }, []);

  // ricerca e proforma
  const cercaArticolo = () => {
    const term = codice.trim().toLowerCase();
    const trovati = articoli.filter(a =>
      a.codice.toLowerCase().includes(term)
    );
    if (!trovati.length)
      toast.info('Nessun articolo trovato.', {
        position: 'top-right'
      });
    setArticoliTrovati(trovati);
  };
  const aggiungiAProforma = item => {
    if (proforma.some(p => p.codice === item.codice)) {
      toast.warning('Già presente', { position: 'top-right' });
      return;
    }
    setProforma([...proforma, { ...item, nota: '', quantita: 1 }]);
    toast.success('Aggiunto', { position: 'top-right' });
  };
  const rimuoviDaProforma = i => {
    const arr = [...proforma];
    arr.splice(i, 1);
    setProforma(arr);
    toast.info('Rimosso', { position: 'top-right' });
  };
  const aggiornaNota = (i, testo) => {
    const arr = [...proforma];
    arr[i].nota = testo;
    setProforma(arr);
  };
  const aggiornaQuantita = (i, val) => {
    const arr = [...proforma];
    arr[i].quantita = parseInt(val) || 1;
    setProforma(arr);
  };
  const resetProforma = () => {
    setProforma([]);
    setCliente('');
    setBanca('');
    setCorriere('');
    setNoteGenerali('');
    toast.info('Campionatura svuotata', {
      position: 'top-right'
    });
  };

  const drawHeaders = (pdf, headers, colW, tableX, yRef) => {
    const headerFont   = 8;
    const headerHeight = 10;
    const pad          = 1;
  
    pdf.setFontSize(headerFont);
    pdf.setFont(undefined, 'bold');
    pdf.setLineHeightFactor(0.8);
  
    let x = tableX;
    let y = yRef.value;
  
    headers.forEach((h, i) => {
      const lines      = h.split('\n');
      const lineHeight = headerFont + 0.2; 
      // non centriamo più: partiamo subito da y+pad
      pdf.rect(x, y, colW[i], headerHeight);
      pdf.text(
      h.split('\n'),
      x + pad,
      y + pad,
      { baseline: 'top' }
    );
    x += colW[i];
  });
        
  pdf.setFont(undefined, 'normal');
  yRef.value = y + headerHeight;
}; 

// genera PDF
const marginTop = 15;
const generaPDF = async () => {
  setIsLoading(true);
  try {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    pdf.setLineHeightFactor(0.8);
    const pw = pdf.internal.pageSize.getWidth();

    // 1) logo + header
    const logo64 = await loadImageBase64('/logoEM.jpg');
    const img = new Image();
    img.src = '/logoEM.jpg';
    await new Promise(r => (img.onload = r));
    const logoW = 50;
    const logoH = (logoW * img.height) / img.width;
    pdf.addImage(logo64, 'JPEG', 10, marginTop, logoW, logoH);

    // 2) testo header con interlinea 4mm
    let cursorY = marginTop + logoH + 2;
    pdf.setFontSize(8);
    [
      'VIA GUIDO ROSSA 184',
      '62015 MONTE SAN GIUSTO MC',
      'P.IVA 01251100532',
      'www.emcompany.it   info@emcompany.it',
      'TEL.+39 0733 539723 FAX +39 0733 837270'
    ].forEach(line => {
      pdf.text(line, 10, cursorY);
      cursorY += 4;
    });

    // 3) blocco cliente/banca/data/corriere
    cursorY += 4;
    pdf.setFontSize(10);
    [
      `Cliente: ${cliente}`,
      `Banca: ${banca}`,
      `Data: ${new Date().toLocaleDateString()}`,
      `Corriere: ${corriere}`
    ].forEach(line => {
      pdf.text(line, 10, cursorY);
      cursorY += 4;
    });

    // 4) rappresentante
    pdf.setFont(undefined, 'bold');
    pdf.text('RAPPRESENTANTE:', pw - 70, marginTop + logoH + 2);
    pdf.text(user?.displayName || '', pw - 70, marginTop + logoH + 8);
    pdf.setFont(undefined, 'normal');

    // 5) preparazione tabella
    const colW = mostraPrezzi
      ? [35, 100, 7.5, 10, 10, 10, 10, 7.5]
      : [35, 135, 7.5, 7.5];
    const headers = mostraPrezzi
      ? ['Codice + Descrizione','Immagine','U.M.','MOQ\nCamp.','Prezzo\nCamp.','MOQ\nProd.','Prezzo\nProd.','Q.tà']
      : ['Codice + Descrizione','Immagine','U.M.','Q.tà'];
    const tableX = 10;
    const rowH = 55;
    let yRef = { value: cursorY + 10 };

    drawHeaders(pdf, headers, colW, tableX, yRef);
    let y = yRef.value;

    // helper unico per tutte le celle (lineHeight = fontSize + 0.5, padding variabile)
    const drawCellText = (text, x, y, width, initialFontSize, padding, availableHeight) => {
      const rawLines = (text || '').split('\n');
      let fontSize = initialFontSize;
      let lines = rawLines.flatMap(l => pdf.splitTextToSize(l, width - padding * 2));
      let lineHeight = fontSize + 0.2;
      let maxLines = Math.floor((availableHeight - padding * 2) / lineHeight);

      while (lines.length > maxLines && fontSize > 5) {
        fontSize -= 0.5;
        lineHeight = fontSize + 0.2;
        lines = rawLines.flatMap(l => pdf.splitTextToSize(l, width - padding * 2));
        maxLines = Math.floor((availableHeight - padding * 2) / lineHeight);
      }

      const usedHeight = Math.min(lines.length, maxLines) * lineHeight;
      const offsetY   = (availableHeight - usedHeight) / 2;
      
      pdf.setFontSize(fontSize);
      pdf.setLineHeightFactor(0.8);
      pdf.text(
        lines.slice(0, maxLines),
        x + padding,
        y + offsetY + padding,
        { baseline: 'top' }
      );
      
    };

    // 6) ciclo righe con controllo di avanzamento pagina
    for (const it of proforma) {
      const pageHeight = pdf.internal.pageSize.getHeight();
      if (y + rowH > pageHeight - 20) {
        pdf.addPage();
        yRef.value = marginTop;
        drawHeaders(pdf, headers, colW, tableX, yRef);
        y = yRef.value;
      }
      

      // disegno griglia
      let x = tableX;
      colW.forEach(w => { pdf.rect(x, y, w, rowH); x += w; });

      let posX = tableX;

      // Codice + Descrizione
      drawCellText(`${it.codice} - ${it.descrizione}`, posX, y, colW[0], 8, 2, rowH);
      posX += colW[0];

      // Immagine
      {
        const { base64, width, height } = await resizeImageSafe(it.immagine);
        let iw = width, ih = height;
        const scale = Math.min((colW[1] - 4) / iw, (rowH - 10) / ih);
        iw *= scale; ih *= scale;
        const ext = it.immagine.toLowerCase().includes('.png') ? 'PNG' : 'JPEG';
        pdf.addImage(base64, ext, posX + (colW[1] - iw) / 2, y + (rowH - ih) / 2, iw, ih);
      }
      posX += colW[1];

      // U.M.
      drawCellText(it.unitaMisura||'', posX, y, colW[2], 6.5, 1, rowH);
      posX += colW[2];

      // prezzi e quantità
      if (mostraPrezzi) {
        ['moqCampione','prezzoCampione','moqProduzione','prezzoProduzione','quantita']
          .forEach((field, idx) => {
            const text = field === 'quantita'
              ? (it.quantita||1).toString()
              : field.includes('prezzo')
                ? `€\n${formatPrezzo(it[field])}`
                : it[field];
            const fontSize = field.includes('prezzo') ? 6 : 6.5;
            const w = idx < 4 ? colW[3 + idx] : colW[7];
            drawCellText(text, posX, y, w, fontSize, 1, rowH);
            posX += w;
          });
      } else {
        drawCellText((it.quantita||1).toString(), posX, y, colW[3], 6.5, 1, rowH);
      }

      // nota (se presente)
      if (it.nota) {
        pdf.setFont(undefined, 'italic');
        drawCellText('Nota: ' + it.nota, tableX, y + rowH - 12, pw - 20, 7, 2, 12);
        pdf.setFont(undefined, 'normal');
      }

      y += rowH;
    }

    pdf.save(`campionatura-${cliente.toLowerCase().replace(/\s+/g,'_')}.pdf`);
  } catch (e) {
    console.error(e);
    toast.error('Errore generazione PDF', { position: 'top-right' });
  } finally {
    setIsLoading(false);
  }
};

  return (
    <>
      <ToastContainer />
      {!user ? (
        <div className="login-container">
          <button onClick={loginGoogle} className="btn-login">
            Login con Google
          </button>
        </div>
      ) : (
        <>
          {isLoading && (
            <div style={{
              position: 'fixed', top: 0, left: 0,
              width: '100%', height: '100%',
              background: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1000
            }}>
              <div className="loader-pdf">Generazione PDF...</div>
            </div>
          )}
          <div className="container">
            <h1>Campionario</h1>
            <p className="welcome">Benvenutə, {user.displayName}</p>
            <button onClick={logout} className="btn-logout">
              Logout
            </button>

            <div className="clienti-inputs">
              <input
                type="text"
                placeholder="Cliente"
                value={cliente}
                onChange={e => setCliente(e.target.value)}
              />
              <input
                type="text"
                placeholder="Banca"
                value={banca}
                onChange={e => setBanca(e.target.value)}
              />
              <input
                type="text"
                placeholder="Corriere"
                value={corriere}
                onChange={e => setCorriere(e.target.value)}
              />
            </div>

            <label style={{ display: 'block', margin: '1rem 0' }}>
              <input
                type="checkbox"
                checked={mostraPrezzi}
                onChange={e => setMostraPrezzi(e.target.checked)}
              />{' '}
              Includi prezzi nel PDF
            </label>

            <div className="search-bar">
              <input
                type="text"
                placeholder="Codice articolo"
                value={codice}
                onChange={e => setCodice(e.target.value)}
              />
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
                    <p>MOQ Campione: {art.moqCampione}</p>
                    <p>
                      Prezzo Campione: €{' '}
                      {formatPrezzo(art.prezzoCampione)}
                    </p>
                    <p>MOQ Produzione: {art.moqProduzione}</p>
                    <p>
                      Prezzo Produzione: €{' '}
                      {formatPrezzo(art.prezzoProduzione)}
                    </p>
                    <img
                      src={art.immagine}
                      alt={art.codice}
                      onClick={() => setPopupImg(art.immagine)}
                    />
                    <button
                      className="btn-add"
                      onClick={() => aggiungiAProforma(art)}
                    >
                      <FaPlus />
                    </button>
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
                <h3>Campionatura</h3>
                <ul>
                  {proforma.map((it, i) => (
                    <li
                      key={it.codice}
                      onContextMenu={e => {
                        e.preventDefault();
                        confermaRimuovi(i);
                      }}
                    >
                      <div className="info">
                        <img
                          src={it.immagine}
                          alt={it.codice}
                          className="thumb"
                          onClick={() => setPopupImg(it.immagine)}
                        />
                        <div className="dati-articolo">
                          <div className="codice">
                            <strong>{it.codice}</strong>
                          </div>
                          <div className="descrizione">
                            {it.descrizione}
                          </div>
                          <div className="righe">
                            <div className="riga-info">
                              <div className="cella-info">
                                <strong>MOQ Camp.</strong>
                                {it.moqCampione}
                              </div>
                              <div className="cella-info">
                                <strong>Prezzo Camp.</strong>€{' '}
                                {formatPrezzo(it.prezzoCampione)}
                              </div>
                              <div className="cella-info">
                                <strong>MOQ Prod.</strong>
                                {it.moqProduzione}
                              </div>
                              <div className="cella-info">
                                <strong>Prezzo Prod.</strong>€{' '}
                                {formatPrezzo(it.prezzoProduzione)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <textarea
                        placeholder="Nota su questo articolo..."
                        value={it.nota}
                        onChange={e =>
                          aggiornaNota(i, e.target.value)
                        }
                      />
                      <input
                        type="number"
                        min="1"
                        className="input-quantita"
                        value={it.quantita}
                        onChange={e =>
                          aggiornaQuantita(i, e.target.value)
                        }
                        placeholder="Quantità"
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
                  <button
                    className="btn-icon"
                    onClick={generaPDF}
                  >
                    <FaFilePdf />
                  </button>
                  <button
                    className="btn-icon btn-danger"
                    onClick={resetProforma}
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
            )}
          </div>

          {showScrollTop && (
            <button
              className="btn-scroll-top"
              onClick={scrollToTop}
            >
              <FaArrowUp />
            </button>
          )}
        </>
      )}
    </>
  );
}

export default App;
