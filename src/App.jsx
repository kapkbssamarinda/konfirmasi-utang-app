import { useState } from 'react';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import ReactConfetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import logoTransparan from './assets/logo_transparan.png';
import './App.css';

// Simple Icon Components
const Icons = {
  Document: () => <span>📄</span>,
  Users: () => <span>👥</span>,
  Download: () => <span>⬇️</span>,
  Upload: () => <span>📤</span>,
  Check: () => <span>✓</span>,
  Info: () => <span>ⓘ</span>,
  Sparkles: () => <span>✨</span>,
  ArrowLeft: () => <span>←</span>,
  File: () => <span>📁</span>,
};

function App() {
  const [templateFile, setTemplateFile] = useState(null);
  const [excelNames, setExcelNames] = useState([]);
  const [manualNames, setManualNames] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [downloadData, setDownloadData] = useState({ blob: null, fileName: '', isZip: false });
  const [activeStep, setActiveStep] = useState(1);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    Kota: '', Tanggal_Konfirmasi: '', Periode: '', Nama_Klien: '',
    Sebutan1: '', Auditor1: '', Sebutan2: '', Auditor2: '',
    Tanggal_Jatuh_Tempo: '', Nama_Direktur: '', Jabatan: ''
  });

  const [bankListRef] = useAutoAnimate();
  const [showConfetti, setShowConfetti] = useState(false);
  const { width, height } = useWindowSize();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
  };

  const validate = () => {
    const newErrors = {};
    if (!templateFile) newErrors.templateFile = 'File template Word wajib diupload';
    if (!formData.Kota.trim()) newErrors.Kota = 'Kota wajib diisi';
    if (!formData.Tanggal_Konfirmasi) newErrors.Tanggal_Konfirmasi = 'Tanggal surat wajib diisi';
    if (!formData.Nama_Klien.trim()) newErrors.Nama_Klien = 'Nama klien wajib diisi';
    if (!formData.Nama_Direktur.trim()) newErrors.Nama_Direktur = 'Nama direktur wajib diisi';
    const allNames = [...new Set([...excelNames, ...manualNames.split('\n').map(n => n.trim()).filter(n => n)])];
    if (allNames.length === 0) newErrors.penerima = 'Minimal satu nama penerima wajib ditambahkan';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheet];
      const json = XLSX.utils.sheet_to_json(worksheet);
      const names = [];
      json.forEach((row) => {
        const nameKey = Object.keys(row).find((key) => key.toLowerCase().includes('nama'));
        if (nameKey && row[nameKey]) names.push(row[nameKey].toString().trim());
      });
      setExcelNames(names);
      setActiveStep(3);
      if (errors.penerima) setErrors((prev) => { const n = { ...prev }; delete n.penerima; return n; });
      alert(`${names.length} nama penerima berhasil dimuat dari Excel!`);
    };
    reader.readAsArrayBuffer(file);
  };

  const generateDocuments = async () => {
    if (!validate()) return;
    setIsProcessing(true);
    try {
      const manualArray = manualNames.split('\n').map((n) => n.trim()).filter((n) => n);
      const allNames = [...new Set([...excelNames, ...manualArray])];
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target.result;
          const zipResult = new JSZip();
          allNames.forEach((penerima) => {
            const zipTemplate = new PizZip(content);
            const doc = new Docxtemplater(zipTemplate, {
              paragraphLoop: true, linebreaks: true, delimiters: { start: '{{', end: '}}' }
            });
            const docData = { ...formData, Nama_Penerima: penerima };
            Object.keys(docData).forEach(key => {
               if(!docData[key]) docData[key] = `{{${key}}}`;
               if((key === 'Sebutan1' || key === 'Sebutan2') && docData[key] === `{{${key}}}`) docData[key] = "";
            });
            doc.render(docData);
            const out = doc.getZip().generate({
              type: 'blob',
              mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            });
            if (allNames.length === 1) {
              setDownloadData({
                blob: out,
                fileName: `Konfirmasi Utang - ${penerima}.docx`,
                isZip: false
              });
            } else {
              zipResult.file(`Konfirmasi Utang - ${penerima}.docx`, out);
            }
          });
          if (allNames.length > 1) {
            const zipContent = await zipResult.generateAsync({ type: 'blob' });
            setDownloadData({
              blob: zipContent,
              fileName: `Konfirmasi Utang - ${formData.Nama_Klien || 'Klien'}.zip`,
              isZip: true
            });
          }
          setHasGenerated(true);
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 5000);
        } catch (error) {
          console.error("Error Detail:", error);
          if (error.properties && error.properties.errors instanceof Array) {
            const errorMessages = error.properties.errors.map(err => `- ${err.properties.explanation}`).join("\n");
            alert("Sistem menemukan masalah pada template Anda:\n" + errorMessages);
          } else {
            alert("Terjadi kesalahan: " + error.message);
          }
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsArrayBuffer(templateFile);
    } catch (error) {
      console.error(error);
      setIsProcessing(false);
    }
  };

  const totalRecipients = new Set([...excelNames, ...manualNames.split('\n').filter(n => n.trim())].filter(n => n)).size;
  const currentStep = hasGenerated ? 4 : activeStep;

  return (
    <div className="app-wrapper">
      {showConfetti && (
        <ReactConfetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={300}
          colors={['#fda4af', '#fb7185', '#e11d48', '#9f1239', '#881337']}
        />
      )}

      {/* Header */}
      <header className="app-header">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <img src={logoTransparan} alt="Logo KAP" className="app-header__logo-img" />
          <div className="app-header__kap-badge">
            KAP Kuncara Budi Santosa &amp; Rekan
          </div>
          <h1 className="app-header__title">Generator Konfirmasi Bank</h1>
          <p className="app-header__subtitle">
            Alat bantu audit untuk membuat surat konfirmasi bank secara massal dan otomatis.
          </p>
        </motion.div>
      </header>

      {/* Main Card */}
      <motion.main
        className="app-card"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
      >
        {/* Progress Bar */}
        <div className="progress-bar">
          {[
            { step: 1, label: 'Template' },
            { step: 2, label: 'Detail' },
            { step: 3, label: 'Penerima' },
          ].map(({ step, label }) => (
            <div
              key={step}
              className={`progress-bar__step ${step === currentStep ? 'active' : ''} ${step < currentStep ? 'completed' : ''}`}
            >
              <div className="progress-bar__circle">
                {step < currentStep ? <Icons.Check /> : step}
              </div>
              <span className="progress-bar__label">{label}</span>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {!hasGenerated ? (
            <motion.div key="form" exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>

              {/* Step 1: Template */}
              <motion.section
                className="section"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <div className="section__header">
                  <span className="section__number">1</span>
                  <div>
                    <h3 className="section__title">Upload Template</h3>
                    <p className="section__description">Pilih file template Word yang akan digunakan</p>
                  </div>
                </div>

                <div className="file-upload mt-3">
                  <motion.label
                    className="file-upload__area"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <input
                      type="file"
                      accept=".docx"
                      className="file-upload__input"
                      onChange={(e) => {
                        setTemplateFile(e.target.files[0]);
                        setActiveStep(2);
                        if (errors.templateFile) setErrors((prev) => { const n = { ...prev }; delete n.templateFile; return n; });
                      }}
                    />
                    <div className="file-upload__icon">📤</div>
                    <p className="file-upload__text">
                      <strong>Pilih file</strong> atau drag &amp; drop di sini
                    </p>
                    <p className="file-upload__hint">Format: .docx • Maks 10MB</p>
                  </motion.label>

                  {templateFile && (
                    <div className="file-upload__preview">
                      <span>📁</span>
                      <span>{templateFile.name}</span>
                    </div>
                  )}
                  {errors.templateFile && <p className="form-error-msg">⚠ {errors.templateFile}</p>}
                </div>

                <div className="mt-3">
                  <a
                    href="/bahan/Konfirmasi-Utang-Template.docx"
                    download
                    className="btn btn--outline"
                  >
                    <Icons.Download /> Download Template Standar
                  </a>
                </div>
              </motion.section>

              {/* Step 2: Detail Audit */}
              <motion.section
                className="section"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <div className="section__header">
                  <span className="section__number">2</span>
                  <div>
                    <h3 className="section__title">Detail Audit</h3>
                    <p className="section__description">Lengkapi informasi yang akan muncul di semua surat</p>
                  </div>
                </div>

                <div className="form-grid mt-3">
                  <div className="form-group">
                    <label className="form-label">Kota <span className="form-label__required">*</span></label>
                    <input
                      name="Kota"
                      className={`form-input${errors.Kota ? ' form-input--error' : ''}`}
                      placeholder="Samarinda"
                      onChange={handleInputChange}
                      value={formData.Kota}
                    />
                    {errors.Kota && <p className="form-error-msg">⚠ {errors.Kota}</p>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Tanggal Surat <span className="form-label__required">*</span></label>
                    <input
                      name="Tanggal_Konfirmasi"
                      type="date"
                      className={`form-input${errors.Tanggal_Konfirmasi ? ' form-input--error' : ''}`}
                      onChange={handleInputChange}
                      value={formData.Tanggal_Konfirmasi}
                    />
                    {errors.Tanggal_Konfirmasi && <p className="form-error-msg">⚠ {errors.Tanggal_Konfirmasi}</p>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Periode Audit</label>
                    <input
                      name="Periode"
                      className="form-input"
                      placeholder="31 Desember 2023"
                      onChange={handleInputChange}
                      value={formData.Periode}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Nama Klien <span className="form-label__required">*</span></label>
                    <input
                      name="Nama_Klien"
                      className={`form-input${errors.Nama_Klien ? ' form-input--error' : ''}`}
                      placeholder="PT Contoh Abadi"
                      onChange={handleInputChange}
                      value={formData.Nama_Klien}
                    />
                    {errors.Nama_Klien && <p className="form-error-msg">⚠ {errors.Nama_Klien}</p>}
                  </div>

                  <div className="form-row">
                    <div className="form-row__item form-row__item--small">
                      <label className="form-label">Sebutan</label>
                      <input
                        name="Sebutan1"
                        className="form-input"
                        placeholder="Bpk"
                        onChange={handleInputChange}
                        value={formData.Sebutan1}
                      />
                    </div>
                    <div className="form-row__item form-row__item--large">
                      <label className="form-label">Auditor 1</label>
                      <input
                        name="Auditor1"
                        className="form-input"
                        placeholder="Nama lengkap"
                        onChange={handleInputChange}
                        value={formData.Auditor1}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-row__item form-row__item--small">
                      <label className="form-label">Sebutan</label>
                      <input
                        name="Sebutan2"
                        className="form-input"
                        placeholder="Ibu"
                        onChange={handleInputChange}
                        value={formData.Sebutan2}
                      />
                    </div>
                    <div className="form-row__item form-row__item--large">
                      <label className="form-label">Auditor 2</label>
                      <input
                        name="Auditor2"
                        className="form-input"
                        placeholder="Nama lengkap"
                        onChange={handleInputChange}
                        value={formData.Auditor2}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Batas Waktu Respon</label>
                    <input
                      name="Tanggal_Jatuh_Tempo"
                      type="date"
                      className="form-input"
                      onChange={handleInputChange}
                      value={formData.Tanggal_Jatuh_Tempo}
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-row__item">
                      <label className="form-label">Nama Direktur <span className="form-label__required">*</span></label>
                      <input
                        name="Nama_Direktur"
                        className={`form-input${errors.Nama_Direktur ? ' form-input--error' : ''}`}
                        placeholder="Nama penanda tangan"
                        onChange={handleInputChange}
                        value={formData.Nama_Direktur}
                      />
                      {errors.Nama_Direktur && <p className="form-error-msg">⚠ {errors.Nama_Direktur}</p>}
                    </div>
                    <div className="form-row__item" style={{ maxWidth: '180px' }}>
                      <label className="form-label">Jabatan</label>
                      <input
                        name="Jabatan"
                        className="form-input"
                        placeholder="Direktur"
                        onChange={handleInputChange}
                        value={formData.Jabatan}
                      />
                    </div>
                  </div>
                </div>
              </motion.section>

              {/* Step 3: Daftar Penerima */}
              <motion.section
                className="section"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                <div className="section__header">
                  <span className="section__number">3</span>
                  <div>
                    <h3 className="section__title">Daftar Penerima</h3>
                    <p className="section__description">Tambahkan nama penerima konfirmasi (minimal 1)</p>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="form-label mb-2">Import dari Excel</label>
                  <div className="file-upload">
                    <motion.label
                      className="file-upload__area"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <input
                        type="file"
                        accept=".xlsx, .xls"
                        className="file-upload__input"
                        onChange={handleExcelUpload}
                      />
                      <div className="file-upload__icon">👥</div>
                      <p className="file-upload__text">
                        <strong>Upload Excel</strong> dengan kolom &ldquo;Nama&rdquo;
                      </p>
                      <p className="file-upload__hint">Format: .xlsx atau .xls</p>
                    </motion.label>
                    <div ref={bankListRef}>
                      {excelNames.length > 0 && (
                        <div className="file-upload__preview">
                          <Icons.Check /> {excelNames.length} bank terdeteksi
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="or-separator">ATAU</div>

                <div>
                  <label className="form-label mb-2">Input Manual</label>
                  <textarea
                    className={`form-textarea${errors.penerima && excelNames.length === 0 ? ' form-textarea--error' : ''}`}
                    placeholder={"PT Maju Bersama\nCV Sejahtera Abadi\nToko Berkah Jaya"}
                    value={manualNames}
                    onChange={(e) => {
                      setManualNames(e.target.value);
                      setActiveStep(3);
                      if (errors.penerima) setErrors((prev) => { const n = { ...prev }; delete n.penerima; return n; });
                    }}
                  />
                  {errors.penerima && <p className="form-error-msg">⚠ {errors.penerima}</p>}
                  <div style={{ textAlign: 'right', marginTop: '8px' }}>
                    <span className={`bank-count-badge ${totalRecipients > 0 ? 'bank-count-badge--active' : 'bank-count-badge--zero'}`}>
                      {totalRecipients > 0 ? '✓' : '○'} Total: {totalRecipients} bank
                    </span>
                  </div>
                </div>
              </motion.section>

              {/* Validation Summary */}
              {Object.keys(errors).length > 0 && (
                <div className="validation-alert">
                  <p className="validation-alert__title">⚠ Harap lengkapi data berikut sebelum generate:</p>
                  <ul className="validation-alert__list">
                    {Object.values(errors).map((msg, i) => (
                      <li key={i} className="validation-alert__item">• {msg}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Bar */}
              <div className="action-bar">
                <button
                  className="btn btn--ghost"
                  onClick={() => {
                    if (window.confirm('Reset semua data?')) {
                      setTemplateFile(null);
                      setExcelNames([]);
                      setManualNames('');
                      setFormData({
                        Kota: '', Tanggal_Konfirmasi: '', Periode: '', Nama_Klien: '',
                        Sebutan1: '', Auditor1: '', Sebutan2: '', Auditor2: '',
                        Tanggal_Jatuh_Tempo: '', Nama_Direktur: '', Jabatan: ''
                      });
                      setErrors({});
                      setActiveStep(1);
                    }
                  }}
                >
                  Reset
                </button>
                <motion.button
                  className="btn btn--primary btn--lg"
                  onClick={generateDocuments}
                  disabled={isProcessing || !templateFile}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {isProcessing ? (
                    <>
                      <span className="btn__spinner"></span>
                      Memproses...
                    </>
                  ) : (
                    <>
                      <Icons.Sparkles />
                      Generate {totalRecipients || 1} Dokumen
                    </>
                  )}
                </motion.button>
              </div>

            </motion.div>
          ) : (
            <motion.div key="result">
              <motion.section
                className="section"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
              >
                <div className="result-card">
                  <motion.div
                    className="result-card__icon"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                  >
                    <Icons.Check />
                  </motion.div>
                  <h4 className="result-card__title">Berhasil! 🎉</h4>
                  <p className="result-card__message">{totalRecipients} Surat Konfirmasi Bank siap diunduh.</p>
                  <p className="result-card__filename">{downloadData.fileName}</p>
                  <motion.button
                    className="btn btn--success btn--lg"
                    onClick={() => saveAs(downloadData.blob, downloadData.fileName)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Icons.Download /> Unduh {downloadData.isZip ? 'ZIP' : 'Dokumen'}
                  </motion.button>
                </div>
                <div className="action-bar mt-4">
                  <button
                    className="btn btn--ghost"
                    onClick={() => { setHasGenerated(false); setShowConfetti(false); }}
                  >
                    <Icons.ArrowLeft /> Buat lagi
                  </button>
                </div>
              </motion.section>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.main>

      {/* Footer */}
      <footer className="text-center text-muted" style={{ fontSize: '0.8125rem' }}>
        <p>Generator Konfirmasi Bank • KAP Kuncara Budi Santosa &amp; Rekan</p>
      </footer>
    </div>
  );
}

export default App;
