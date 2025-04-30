// src/App.js
import React, { useState, useEffect } from 'react';
import './index.css';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FaFilePdf, FaPlus, FaTrash, FaArrowUp } from 'react-icons/fa';
import {
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
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

  // genera PDF
  const generaPDF = async () => {
    setIsLoading(true);
    try {
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      // logo + header
      const logo64 = await loadImageBase64('/logoEM.jpg');
      const img = new Image();
      img.src = '/logoEM.jpg';
      await new Promise(r => (img.onload = r));
      const logoW = 40;
      const logoH = (logoW * img.height) / img.width;
      pdf.addImage(logo64, 'JPEG', 10, 5, logoW, logoH);
      const headerY = 5 + logoH + 2;
      pdf.setFontSize(8);
      pdf.text('VIA GUIDO ROSSA 184', 10, headerY);
      pdf.text('62015 MONTE SAN GIUSTO MC', 10, headerY + 4);
      pdf.text('P.IVA 01251100532', 10, headerY + 8);
      pdf.text(
        'www.emcompany.it   info@emcompany.it',
        10,
        headerY + 12
      );
      pdf.text(
        'TEL.+39 0733 539723 FAX +39 0733 837270',
        10,
        headerY + 16
      );
      // cliente
      const infoY = headerY + 24;
      pdf.setFontSize(10);
      pdf.text(`Cliente: ${cliente}`, 10, infoY);
      pdf.text(`Banca: ${banca}`, 10, infoY + 6);
      pdf.text(`Data: ${new Date().toLocaleDateString()}`, 10, infoY + 12);
      pdf.text(`Corriere: ${corriere}`, 10, infoY + 18);
      pdf.setFont(undefined, 'bold');
      pdf.text('RAPPRESENTANTE:', pw - 70, infoY);
      pdf.text(user?.displayName || '', pw - 70, infoY + 6);
      pdf.setFont(undefined, 'normal');
      pdf.text(user?.email || '', pw - 70, infoY + 12);

      // colonne dinamiche
      const colW = mostraPrezzi
      ? [35, 100, 5, 10, 10, 10, 10, 5]
      : [35, 100, 5, 10, /*MOQ Prod.*/10, /*Q.tà*/5];
      const headers = mostraPrezzi
        ? [
            'Codice + Descrizione',
            'Immagine',
            'U.M.',
            'MOQ Camp.',
            'Prezzo Camp.',
            'MOQ Prod.',
            'Prezzo Prod.',
            'Q.tà'
          ]
        : [
            'Codice + Descrizione',
            'Immagine',
            'U.M.',
            'MOQ Camp.',
            'MOQ Prod.',
            'Q.tà'
          ];

      const tableX = 10;
      const rowH = 55;
      let y = infoY + 30;
      let rowCount = 0;

      const drawHeaders = () => {
        let x = tableX;
        pdf.setFontSize(8);
        pdf.setFont(undefined, 'bold');
        headers.forEach((h, i) => {
          pdf.rect(x, y, colW[i], 8);
          pdf.text(h, x + colW[i] / 2, y + 5, { align: 'center' });
          x += colW[i];
        });
        pdf.setFont(undefined, 'normal');
        y += 8;
      };

      drawHeaders();

      for (const it of proforma) {
        if (rowCount >= 4) {
          pdf.addPage();
          y = 20;
          drawHeaders();
          rowCount = 0;
        }

        // riga griglia
        let x = tableX;
        colW.forEach(w => {
          pdf.rect(x, y, w, rowH);
          x += w;
        });

        // contenuti colonna per colonna
        let posX = tableX;
        // codice+descrizione
        pdf.setFontSize(8);
        pdf.text(it.codice, posX + 2, y + 6);
        pdf.setFontSize(7);
        pdf.text(
          pdf.splitTextToSize(it.descrizione, colW[0] - 4),
          posX + 2,
          y + 12
        );
        pdf.setFontSize(8);
        posX += colW[0];

        // immagine
        const { base64, width, height } = await resizeImageSafe(
          it.immagine
        );
        let iw = width,
          ih = height;
        const scale = Math.min(
          (colW[1] - 4) / iw,
          (rowH - 10) / ih
        );
        iw *= scale;
        ih *= scale;
        const ext = it.immagine.toLowerCase().includes('.png')
          ? 'PNG'
          : 'JPEG';
        pdf.addImage(
          base64,
          ext,
          posX + (colW[1] - iw) / 2,
          y + (rowH - ih) / 2,
          iw,
          ih
        );
        posX += colW[1];

        // U.M.
        pdf.text(it.unitaMisura, posX + 2, y + 6);
        posX += colW[2];

        // MOQ Camp.
        pdf.text(it.moqCampione, posX + 2, y + 6);
        posX += colW[3];

        // Prezzo Camp.
        if (mostraPrezzi) {
          pdf.text(
            `€ ${formatPrezzo(it.prezzoCampione)}`,
            posX + 2,
            y + 6
          );
          posX += colW[4];
        }

        // MOQ Prod.
        pdf.text(it.moqProduzione, posX + 2, y + 6);
        posX += mostraPrezzi ? colW[5] : colW[4];

        // Prezzo Prod.
        if (mostraPrezzi) {
          pdf.text(
            `€ ${formatPrezzo(it.prezzoProduzione)}`,
            posX + 2,
            y + 6
          );
          posX += colW[6];
        }

        // Quantità
        pdf.text(it.quantita.toString(), posX + 2, y + 6);

        // nota sotto
        const testoY = y + rowH - 12;
        if (it.nota) {
          pdf.setFont(undefined, 'italic');
          pdf.text(
            'Nota: ' + it.nota,
            tableX + 1,
            testoY + 5
          );
          pdf.setFont(undefined, 'normal');
        }

        y += rowH;
        rowCount++;
      }

      // note generali
      if (noteGenerali) {
        let footerY = y + 10;
        if (footerY + 20 > ph) {
          pdf.addPage();
          footerY = 20;
        }
        pdf.setFontSize(10);
        pdf.text('Note generali:', 10, footerY);
        pdf.setFontSize(8);
        pdf.text(
          pdf.splitTextToSize(noteGenerali, pw - 20),
          10,
          footerY + 5
        );
      }

      pdf.save(`campionatura-${cliente
        .toLowerCase()
        .replace(/\s+/g, '_')}.pdf`);
    } catch (e) {
      console.error(e);
      toast.error('Errore generazione PDF', {
        position: 'top-right'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const confermaRimuovi = i => {
    toast(
      ({ closeToast }) => (
        <div className="toast-conferma-rimozione">
          <p>Rimuovere questo articolo?</p>
          <div className="toast-bottoni">
            <button
              className="btn-rimuovi"
              onClick={() => {
                rimuoviDaProforma(i);
                closeToast();
              }}
            >
              Sì
            </button>
            <button className="btn-annulla" onClick={closeToast}>
              No
            </button>
          </div>
        </div>
      ),
      { position: 'top-center', autoClose: false, closeButton: false }
    );
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
            <div className="loader-pdf">Generazione PDF...</div>
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
