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
  return new Promise((resolve) => {
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
    await new Promise((resolve) => (img.onload = resolve));
    const canvas = document.createElement('canvas');
    const scale = maxWidth / img.width;
    canvas.width = maxWidth;
    canvas.height = img.height * scale;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'low';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return {
      base64: canvas.toDataURL('image/jpeg', 0.4),
      width: img.width,
      height: img.height,
    };
  } catch (e) {
    console.warn('Errore nel ridimensionamento sicuro', e);
    return { base64: src, width: 1, height: 1 };
  }
};

function App() {
  // Stato e persistenza
  const savedState = JSON.parse(localStorage.getItem('appState') || '{}');
  const [articoli, setArticoli] = useState([]);
  const [articoliTrovati, setArticoliTrovati] = useState([]);
  const [codice, setCodice] = useState('');
  const [proforma, setProforma] = useState(savedState.proforma || []);
  const [cliente, setCliente] = useState(savedState.cliente || '');
  const [rappresentante, setRappresentante] = useState(savedState.rappresentante || '');
  const [noteGenerali, setNoteGenerali] = useState(savedState.noteGenerali || '');
  const [popupImg, setPopupImg] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Salva su localStorage
  useEffect(() => {
    localStorage.setItem(
      'appState',
      JSON.stringify({ proforma, cliente, rappresentante, noteGenerali })
    );
  }, [proforma, cliente, rappresentante, noteGenerali]);

  // Caricamento CSV con Papa Parse
  useEffect(() => {
    Papa.parse(
      'https://docs.google.com/spreadsheets/d/e/.../pub?output=csv',
      {
        download: true,
        header: true,
        complete: (results) => {
          const mapped = results.data.map((item) => ({
            codice: item.Codice || '',
            descrizione: item.Descrizione || '',
            unitaMisura: item['Unità di misura'] || '',
            moq: item['M.O.Q.'] || '',
            prezzoCampione: item['Prezzo Campione'] || '0',
            prezzoProduzione: item['Prezzo Produzione'] || '0',
            immagine: item.Immagine || '',
          }));
          setArticoli(mapped);
        },
        error: (error) => {
          toast.error('Errore caricamento articoli: ' + error.message, {
            position: 'top-right',
          });
        },
      }
    );
  }, []);

  // Autenticazione
  const provider = new GoogleAuthProvider();
  const [user, setUser] = useState(null);
  const loginGoogle = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Errore login:', error);
      toast.error('Errore login: ' + error.message, { position: 'top-right' });
    }
  };
  const logout = () => signOut(auth);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  // Ricerca articoli
  const cercaArticolo = () => {
    const term = codice.trim().toLowerCase();
    const trovati = articoli.filter((a) =>
      a.codice.toLowerCase().includes(term)
    );
    if (trovati.length === 0) {
      toast.info('Nessun articolo trovato.', { position: 'top-right' });
    }
    setArticoliTrovati(trovati);
  };

  // Gestione Proforma
  const aggiungiAProforma = (item) => {
    if (proforma.some((p) => p.codice === item.codice)) {
      toast.warning(`L'articolo ${item.codice} è già presente`);
      return;
    }
    setProforma([...proforma, { ...item, nota: '' }]);
    toast.success(`Articolo ${item.codice} aggiunto`);
  };
  const rimuoviDaProforma = (index) => {
    const nuova = [...proforma];
    nuova.splice(index, 1);
    setProforma(nuova);
    toast.info('Articolo rimosso');
  };
  const aggiornaNota = (index, testo) => {
    const nuova = [...proforma];
    nuova[index].nota = testo;
    setProforma(nuova);
  };
  const resetProforma = () => {
    setProforma([]);
    setCliente('');
    setRappresentante('');
    setNoteGenerali('');
    toast.info('Proforma svuotata');
  };

  // Generazione PDF con multi-pagina
  const generaPDF = async () => {
    setIsLoading(true);
    try {
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
      // Logo
      const logoBase64 = await loadImageBase64('/logoEM.jpg');
      const img = new Image(); img.src = '/logoEM.jpg';
      await new Promise((r) => (img.onload = r));
      const logoW = 40;
      const logoH = logoW * (img.height / img.width);

      // Colonne
      const cols = [
        { key: 'img', label: '', x: 10, w: 20 },
        { key: 'codice', label: 'Codice', x: 30, w: 25 },
        { key: 'descrizione', label: 'Descrizione', x: 55, w: 50 },
        { key: 'unitaMisura', label: 'U.M.', x: 105, w: 15 },
        { key: 'moq', label: 'M.O.Q.', x: 120, w: 15 },
        { key: 'prezzoCampione', label: 'Prezzo C.', x: 135, w: 20 },
        { key: 'prezzoProduzione', label: 'Prezzo P.', x: 155, w: 20 },
        { key: 'nota', label: 'Nota', x: 175, w: 25 },
      ];
      const rowHeight = 12;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const drawHeader = () => {
        pdf.addImage(logoBase64, 'JPEG', 10, 5, logoW, logoH);
        pdf.setFontSize(16);
        pdf.text('Proforma Ordine Campionario', pageWidth / 2, 20, { align: 'center' });
        pdf.setFontSize(10);
        pdf.text(`Cliente: ${cliente}`, 10, 30);
        pdf.text(`Rappresentante: ${rappresentante}`, 10, 36);
      };
      const drawTableHeader = (y) => {
        pdf.setFontSize(8);
        cols.forEach((c) => {
          pdf.rect(c.x, y, c.w, rowHeight);
          pdf.text(c.label, c.x + c.w / 2, y + rowHeight / 2 + 2, {
            align: 'center',
          });
        });
      };

      let y = 45;
      drawHeader();
      drawTableHeader(y);
      y += rowHeight;

      let totale = 0;
      for (const item of proforma) {
        if (y + rowHeight > pageHeight - 20) {
          pdf.addPage();
          y = 20;
          drawHeader();
          drawTableHeader(y);
          y += rowHeight;
        }
        // Immagine
        const { base64, width, height } = await resizeImageSafe(
          item.immagine
        );
        const maxImgW = cols[0].w - 2;
        const maxImgH = rowHeight - 2;
        let imgW = maxImgW;
        let imgH = (imgW * height) / width;
        if (imgH > maxImgH) {
          imgH = maxImgH;
          imgW = (imgH * width) / height;
        }
        pdf.addImage(
          base64,
          'JPEG',
          cols[0].x + 1,
          y + 1 + (maxImgH - imgH) / 2,
          imgW,
          imgH
        );
        // Testi
        pdf.setFontSize(8);
        pdf.text(item.codice, cols[1].x + cols[1].w / 2, y + rowHeight / 2 + 2, { align: 'center' });
        const descrLines = pdf.splitTextToSize(item.descrizione || '', cols[2].w - 2);
        pdf.text(descrLines, cols[2].x + 1, y + 4);
        pdf.text(item.unitaMisura, cols[3].x + cols[3].w / 2, y + rowHeight / 2 + 2, { align: 'center' });
        pdf.text(item.moq, cols[4].x + cols[4].w / 2, y + rowHeight / 2 + 2, { align: 'center' });
        pdf.text(`€ ${formatPrezzo(item.prezzoCampione)}`, cols[5].x + cols[5].w / 2, y + rowHeight / 2 + 2, { align: 'center' });
        pdf.text(`€ ${formatPrezzo(item.prezzoProduzione)}`, cols[6].x + cols[6].w / 2, y + rowHeight / 2 + 2, { align: 'center' });
        if (item.nota) {
          const noteLines = pdf.splitTextToSize(item.nota, cols[7].w - 2);
          pdf.text(noteLines, cols[7].x + 1, y + 4);
        }
        totale += parseFloat(
          item.prezzoCampione.toString().replace(',', '.')
        );
        y += rowHeight;
      }
      // Totale & note generali
      if (y + 10 > pageHeight - 20) {
        pdf.addPage();
        y = 20;
      }
      pdf.setFontSize(12);
      pdf.text(`Totale: € ${totale.toFixed(2)}`, pageWidth - 20, y + 5, {
        align: 'right',
      });
      if (noteGenerali) {
        y += 10;
        pdf.setFontSize(10);
        pdf.text('Note generali:', 10, y + 5);
        const noteGenLines = pdf.splitTextToSize(noteGenerali, pageWidth - 20);
        pdf.text(noteGenLines, 10, y + 10);
      }
      // Salvataggio file
      const safeName = cliente
        ? `proforma-${cliente
            .toLowerCase()
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .replace(/\s+/g, '_')
            .replace(/[^\w\-]/g, '')}.pdf`
        : 'proforma-senza-nome.pdf';
      pdf.save(safeName);
    } catch (e) {
      console.error(e);
      toast.error('Errore generazione PDF');
    } finally {
      setIsLoading(false);
    }
  };

  // Conferme rimozione
  const mostraMenuRimozione = (index) => {
    toast(({ closeToast }) => (
      <div className="toast-conferma-rimozione">
        <p>Rimuovere questo articolo?</p>
        <div className="toast-bottoni">
          <button
            className="btn-rimuovi"
            onClick={() => { rimuoviDaProforma(index); closeToast(); }}
          >
            Sì
          </button>
          <button className="btn-annulla" onClick={closeToast}>No</button>
        </div>
      </div>
    ), {
      position: 'top-center',
      autoClose: false,
      closeButton: false,
      draggable: false,
    });
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
          {isLoading && <div className="loader-pdf">Generazione PDF...</div>}
          <div className="container">
            <h1>Campionario</h1>
            <p className="welcome">Benvenutə, {user.displayName}</p>
            <button onClick={logout} className="btn-logout">Logout</button>
            <div className="clienti-inputs">
              <input
                type="text"
                placeholder="Cliente"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
              />
              <input
                type="text"
                placeholder="Rappresentante"
                value={rappresentante}
                onChange={(e) => setRappresentante(e.target.value)}
              />
            </div>
            <div className="search-bar">
              <input
                type="text"
                placeholder="Codice articolo"
                value={codice}
                onChange={(e) => setCodice(e.target.value)}
              />
              <button onClick={cercaArticolo}>Cerca</button>
            </div>
            {articoliTrovati.length > 0 && (
              <div className="risultati">
                <h2>Risultati</h2>
                {articoliTrovati.map((art) => (
                  <div key={art.codice} className="scheda">
                    <h3>{art.codice}</h3>
                    <p>{art.descrizione}</p>
                    <p>U.M.: {art.unitaMisura}</p>
                    <p>MOQ: {art.moq}</p>
                    <p>Campione: € {formatPrezzo(art.prezzoCampione)}</p>
                    <p>Produzione: € {formatPrezzo(art.prezzoProduzione)}</p>
                    <img
                      src={art.immagine}
                      alt={art.codice}
                      onClick={() => setPopupImg(art.immagine)}
                    />
                    <button className="btn-add" onClick={() => aggiungiAProforma(art)}>
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
                <h3>Proforma</h3>
                <ul>
                  {proforma.map((item, i) => ( 
                    <li
                      key={item.codice}
                      onContextMenu={(e) => { e.preventDefault(); mostraMenuRimozione(i); }}
                    >
                      <div className="info">
                        <img
                          src={item.immagine}
                          alt={item.codice}
                          className="thumb"
                          onClick={() => setPopupImg(item.immagine)}
                        />
                        <span>{item.codice}</span>
                        <span>Camp.: € {formatPrezzo(item.prezzoCampione)}</span>
                        <span>Prod.: € {formatPrezzo(item.prezzoProduzione)}</span>
                      </div>
                      <textarea
                        placeholder="Nota su questo articolo..."
                        value={item.nota}
                        onChange={(e) => aggiornaNota(i, e.target.value)}
                      />
                    </li>
                  ))}
                </ul>
                <textarea
                  placeholder="Note generali..."
                  value={noteGenerali}
                  onChange={(e) => setNoteGenerali(e.target.value)}
                  rows={3}
                  className="note-generali"
                />
                <div className="bottoni-proforma">
                  <button className="btn-icon" onClick={generaPDF}>
                    <FaFilePdf />
                  </button>
                  <button
                    className="btn-icon btn-danger"
                    onClick={() => {
                      if (proforma.length === 0) return;
                      toast(({ closeToast }) => (
                        <div className="toast-conferma-rimozione">
                          <p>Vuoi svuotare tutta la proforma?</p>
                          <div className="toast-bottoni">
                            <button
                              className="btn-rimuovi"
                              onClick={() => { resetProforma(); closeToast(); }}
                            >
                              Sì
                            </button>
                            <button className="btn-annulla" onClick={closeToast}>
                              No
                            </button>
                          </div>
                        </div>
                      ), {
                        position: 'top-center',
                        autoClose: false,
                        closeButton: false,
                        draggable: false,
                      });
                    }}
                  >
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
