import { useState, useMemo } from 'react';
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

// 1. Indonesian Months
const BULAN_INDONESIA = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

// 2. Format Tanggal Indonesia Standar ("1 Januari 2025")
export const formatTanggalIndonesia = (input) => {
  if (!input) return '';

  // If Date object
  if (input instanceof Date && !isNaN(input.getTime())) {
    const d = input.getDate();
    const m = BULAN_INDONESIA[input.getMonth()];
    const y = input.getFullYear();
    return `${d} ${m} ${y}`;
  }

  // If numeric (Excel serial date: e.g. 45658)
  if (typeof input === 'number' || (!isNaN(input) && !input.toString().includes('-') && !input.toString().includes('/'))) {
    const num = Number(input);
    if (num > 20000 && num < 70000) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const dateObj = new Date(excelEpoch.getTime() + num * 86400 * 1000);
      const d = dateObj.getUTCDate();
      const m = BULAN_INDONESIA[dateObj.getUTCMonth()];
      const y = dateObj.getUTCFullYear();
      return `${d} ${m} ${y}`;
    }
  }

  const str = input.toString().trim();
  if (!str) return '';

  // Check if it's already "D MMMM YYYY" format
  for (let i = 0; i < BULAN_INDONESIA.length; i++) {
    const b = BULAN_INDONESIA[i];
    const regex = new RegExp(`^(\\d{1,2})\\s+${b}\\s+(\\d{4})$`, 'i');
    const match = str.match(regex);
    if (match) {
      return `${parseInt(match[1], 10)} ${b} ${match[2]}`;
    }
  }

  // Format YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(str)) {
    const parts = str.split('T')[0].split('-');
    const y = parts[0];
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${d} ${BULAN_INDONESIA[m - 1]} ${y}`;
    }
  }

  // Format DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    const y = dmyMatch[3];
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${d} ${BULAN_INDONESIA[m - 1]} ${y}`;
    }
  }

  // Try standard JS Date parsing
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1970) {
    const d = parsed.getDate();
    const m = BULAN_INDONESIA[parsed.getMonth()];
    const y = parsed.getFullYear();
    return `${d} ${m} ${y}`;
  }

  return str;
};

// 3. Format Rupiah ("Rp 15.000.000")
export const formatRupiah = (val) => {
  if (val === null || val === undefined || val === '') return '';
  const str = val.toString().trim();
  const digits = str.replace(/[^\d]/g, '');
  if (!digits) return '';
  const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `Rp ${formatted}`;
};

// 4. Parse Rupiah string to Number
export const parseRupiahNumber = (val) => {
  if (!val) return 0;
  const digits = val.toString().replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
};

// SVG Icons
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
  Plus: () => <span>➕</span>,
  Trash: () => <span>🗑️</span>,
  Table: () => <span>📊</span>,
  Clipboard: () => <span>📋</span>,
  Money: () => <span>💰</span>,
  Calendar: () => <span>📅</span>,
};

function App() {
  const [templateFile, setTemplateFile] = useState(null);
  const [recipients, setRecipients] = useState([
    { id: 'rec_init_1', name: '', nominal: '' }
  ]);
  const [batchText, setBatchText] = useState('');
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [downloadData, setDownloadData] = useState({ blob: null, fileName: '', isZip: false, count: 0 });
  const [activeStep, setActiveStep] = useState(1);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    Kota: '',
    Tanggal_Konfirmasi: '',
    Periode: '',
    Nama_Klien: '',
    Sebutan1: '',
    Auditor1: '',
    Sebutan2: '',
    Auditor2: '',
    Tanggal_Jatuh_Tempo: '',
    Nama_Direktur: '',
    Jabatan: '',
    Nominal_Default: ''
  });

  const [tableBodyRef] = useAutoAnimate();
  const [showConfetti, setShowConfetti] = useState(false);
  const { width, height } = useWindowSize();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const n = { ...prev };
        delete n[name];
        return n;
      });
    }
  };

  const validRecipients = useMemo(() => {
    return recipients.filter((r) => r.name.trim().length > 0);
  }, [recipients]);

  const totalNominalSum = useMemo(() => {
    let sum = 0;
    validRecipients.forEach((r) => {
      const val = r.nominal || formData.Nominal_Default;
      sum += parseRupiahNumber(val);
    });
    return sum;
  }, [validRecipients, formData.Nominal_Default]);

  const validate = () => {
    const newErrors = {};
    if (!templateFile) newErrors.templateFile = 'File template Word (.docx) wajib diupload';
    if (!formData.Kota.trim()) newErrors.Kota = 'Kota wajib diisi';
    if (!formData.Tanggal_Konfirmasi) newErrors.Tanggal_Konfirmasi = 'Tanggal surat konfirmasi wajib diisi';
    if (!formData.Nama_Klien.trim()) newErrors.Nama_Klien = 'Nama klien wajib diisi';
    if (!formData.Nama_Direktur.trim()) newErrors.Nama_Direktur = 'Nama direktur penanda tangan wajib diisi';

    if (validRecipients.length === 0) {
      newErrors.penerima = 'Minimal satu nama penerima/kreditur wajib diisi pada tabel';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Helper keyword matching for Excel columns
  const findNameKey = (keys) => {
    const nameKeywords = [
      'nama', 'kreditur', 'debitur', 'klien', 'penerima', 'vendor', 'supplier',
      'customer', 'perusahaan', 'bank', 'rekanan', 'tujuan', 'client'
    ];
    for (const kw of nameKeywords) {
      const found = keys.find((k) => k.toLowerCase().includes(kw));
      if (found) return found;
    }
    return keys[0] || null;
  };

  const findNominalKey = (keys) => {
    const nominalKeywords = [
      'nominal', 'saldo', 'jumlah', 'utang', 'piutang', 'nilai', 'amount',
      'total', 'rp', 'tagihan', 'balance', 'hutang', 'kewajiban'
    ];
    for (const kw of nominalKeywords) {
      const found = keys.find((k) => k.toLowerCase().includes(kw));
      if (found) return found;
    }
    return null;
  };

  const findDateKey = (keys) => {
    const dateKeywords = ['tanggal', 'tgl', 'periode', 'tempo', 'date', 'konfirmasi'];
    for (const kw of dateKeywords) {
      const found = keys.find((k) => k.toLowerCase().includes(kw));
      if (found) return found;
    }
    return null;
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheet];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!json || json.length === 0) {
          alert('File Excel kosong atau tidak memiliki baris data.');
          return;
        }

        const keys = Object.keys(json[0] || {});
        const nameKey = findNameKey(keys);
        const nominalKey = findNominalKey(keys);
        const dateKey = findDateKey(keys);

        const parsedRecipients = [];
        let detectedDate = null;

        json.forEach((row, idx) => {
          const rawName = nameKey && row[nameKey] !== undefined ? row[nameKey].toString().trim() : '';
          if (!rawName) return;

          const rawNominal = nominalKey && row[nominalKey] !== undefined ? row[nominalKey] : '';
          const formattedNominal = rawNominal ? formatRupiah(rawNominal) : '';

          if (!detectedDate && dateKey && row[dateKey]) {
            detectedDate = row[dateKey];
          }

          parsedRecipients.push({
            id: `excel_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
            name: rawName,
            nominal: formattedNominal
          });
        });

        if (parsedRecipients.length === 0) {
          alert('Tidak ditemukan kolom nama penerima/kreditur yang valid pada file Excel.');
          return;
        }

        // If date detected and not yet set in form
        if (detectedDate && !formData.Tanggal_Konfirmasi) {
          if (detectedDate instanceof Date) {
            const iso = detectedDate.toISOString().split('T')[0];
            setFormData((prev) => ({ ...prev, Tanggal_Konfirmasi: iso }));
          }
        }

        // Filter out initial empty row if only one empty row exists
        setRecipients((prev) => {
          const existing = prev.filter((r) => r.name.trim().length > 0);
          return [...existing, ...parsedRecipients];
        });

        setActiveStep(3);
        if (errors.penerima) {
          setErrors((prev) => {
            const n = { ...prev };
            delete n.penerima;
            return n;
          });
        }
        alert(`Berhasil memuat ${parsedRecipients.length} data penerima/kreditur dari Excel!`);
        e.target.value = '';
      } catch (err) {
        console.error('Excel parse error:', err);
        alert('Gagal membaca file Excel: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleApplyBatchText = () => {
    const text = batchText.trim();
    if (!text) {
      alert('Silakan masukkan teks nama dan nominal terlebih dahulu.');
      return;
    }

    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const newRecipients = [];

    lines.forEach((line, idx) => {
      let name = '';
      let nominal = '';

      if (line.includes('\t')) {
        // Tab-separated (copy from Excel / Google Sheets)
        const parts = line.split('\t');
        name = parts[0]?.trim() || '';
        nominal = parts.slice(1).join(' ').trim();
      } else if (line.includes('|')) {
        // Pipe-separated
        const parts = line.split('|');
        name = parts[0]?.trim() || '';
        nominal = parts.slice(1).join(' ').trim();
      } else if (line.includes(';')) {
        // Semicolon-separated
        const parts = line.split(';');
        name = parts[0]?.trim() || '';
        nominal = parts.slice(1).join(' ').trim();
      } else if (line.includes(',')) {
        // Comma-separated (check if right part is numeric)
        const lastCommaIdx = line.lastIndexOf(',');
        const left = line.substring(0, lastCommaIdx).trim();
        const right = line.substring(lastCommaIdx + 1).trim();
        if (/^(\d|rp)/i.test(right.replace(/[\s\.]/g, ''))) {
          name = left;
          nominal = right;
        } else {
          name = line;
        }
      } else {
        name = line;
      }

      if (name) {
        newRecipients.push({
          id: `batch_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
          name: name,
          nominal: nominal ? formatRupiah(nominal) : ''
        });
      }
    });

    if (newRecipients.length > 0) {
      setRecipients((prev) => {
        const existing = prev.filter((r) => r.name.trim().length > 0);
        return [...existing, ...newRecipients];
      });
      setBatchText('');
      setShowBatchModal(false);
      setActiveStep(3);
      if (errors.penerima) {
        setErrors((prev) => {
          const n = { ...prev };
          delete n.penerima;
          return n;
        });
      }
      alert(`Berhasil menambahkan ${newRecipients.length} penerima/kreditur dari teks batch!`);
    }
  };

  // Table row actions
  const handleAddRow = () => {
    setRecipients((prev) => [
      ...prev,
      {
        id: `manual_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: '',
        nominal: ''
      }
    ]);
  };

  const handleUpdateRow = (id, field, value) => {
    setRecipients((prev) =>
      prev.map((rec) => {
        if (rec.id !== id) return rec;
        if (field === 'nominal') {
          return { ...rec, nominal: formatRupiah(value) };
        }
        return { ...rec, [field]: value };
      })
    );
    if (errors.penerima) {
      setErrors((prev) => {
        const n = { ...prev };
        delete n.penerima;
        return n;
      });
    }
  };

  const handleDeleteRow = (id) => {
    setRecipients((prev) => {
      const remaining = prev.filter((rec) => rec.id !== id);
      if (remaining.length === 0) {
        return [{ id: `init_${Date.now()}`, name: '', nominal: '' }];
      }
      return remaining;
    });
  };

  const handleClearTable = () => {
    if (validRecipients.length === 0) {
      setRecipients([{ id: `init_${Date.now()}`, name: '', nominal: '' }]);
      return;
    }
    if (window.confirm('Apakah Anda yakin ingin mengosongkan seluruh tabel penerima/kreditur?')) {
      setRecipients([{ id: `init_${Date.now()}`, name: '', nominal: '' }]);
    }
  };

  // Word Document Generation Engine
  const generateDocuments = async () => {
    if (!validate()) return;
    setIsProcessing(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target.result;
          const zipResult = new JSZip();

          validRecipients.forEach((rec, index) => {
            const zipTemplate = new PizZip(content);
            const doc = new Docxtemplater(zipTemplate, {
              paragraphLoop: true,
              linebreaks: true,
              delimiters: { start: '{{', end: '}}' }
            });

            const nominalValue = rec.nominal || formData.Nominal_Default || '';

            const docData = {
              ...formData,
              Nama_Penerima: rec.name,
              nama_penerima: rec.name,
              NAMA_PENERIMA: rec.name,
              Nama: rec.name,
              nama: rec.name,

              // Nominal mappings & variations
              nominal: nominalValue,
              Nominal: nominalValue,
              NOMINAL: nominalValue,
              nominal_utang: nominalValue,
              Nominal_Utang: nominalValue,
              nominal_piutang: nominalValue,
              Nominal_Piutang: nominalValue,
              saldo: nominalValue,
              Saldo: nominalValue,
              jumlah: nominalValue,
              Jumlah: nominalValue,
            };

            // Format Dates
            const formattedTglKonfirmasi = formatTanggalIndonesia(formData.Tanggal_Konfirmasi);
            docData.Tanggal_Konfirmasi = formattedTglKonfirmasi;
            docData.tanggal_konfirmasi = formattedTglKonfirmasi;
            docData.Tanggal = formattedTglKonfirmasi;
            docData.tanggal = formattedTglKonfirmasi;

            const formattedTglTempo = formatTanggalIndonesia(formData.Tanggal_Jatuh_Tempo);
            docData.Tanggal_Jatuh_Tempo = formattedTglTempo;
            docData.tanggal_jatuh_tempo = formattedTglTempo;
            docData.Jatuh_Tempo = formattedTglTempo;
            docData.jatuh_tempo = formattedTglTempo;

            if (formData.Periode) {
              const formattedPeriode = formatTanggalIndonesia(formData.Periode);
              docData.Periode = formattedPeriode;
              docData.periode = formattedPeriode;
              docData.PERIODE = formattedPeriode;
            }

            // Fallback for missing tags
            Object.keys(docData).forEach((key) => {
              if (docData[key] === undefined || docData[key] === null || docData[key] === '') {
                if (key === 'Sebutan1' || key === 'Sebutan2') {
                  docData[key] = '';
                } else {
                  docData[key] = `{{${key}}}`;
                }
              }
            });

            doc.render(docData);
            const out = doc.getZip().generate({
              type: 'blob',
              mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            });

            const safeRecipientName = rec.name.replace(/[/\\?%*:|"<>]/g, '-').trim() || `Penerima-${index + 1}`;
            const singleFileName = `Konfirmasi Utang - ${safeRecipientName}.docx`;

            if (validRecipients.length === 1) {
              setDownloadData({
                blob: out,
                fileName: singleFileName,
                isZip: false,
                count: 1
              });
            } else {
              zipResult.file(singleFileName, out);
            }
          });

          if (validRecipients.length > 1) {
            const zipContent = await zipResult.generateAsync({ type: 'blob' });
            const safeClientName = (formData.Nama_Klien || 'Klien').replace(/[/\\?%*:|"<>]/g, '-').trim();
            setDownloadData({
              blob: zipContent,
              fileName: `Konfirmasi Utang - ${safeClientName}.zip`,
              isZip: true,
              count: validRecipients.length
            });
          }

          setHasGenerated(true);
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 6000);
        } catch (error) {
          console.error("Error Detail:", error);
          if (error.properties && error.properties.errors instanceof Array) {
            const errorMessages = error.properties.errors.map((err) => `- ${err.properties.explanation}`).join("\n");
            alert("Sistem menemukan masalah pada template Word Anda:\n" + errorMessages);
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

  const currentStep = hasGenerated ? 4 : activeStep;

  return (
    <div className="app-wrapper">
      {showConfetti && (
        <ReactConfetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={350}
          colors={['#10b981', '#0d9488', '#059669', '#34d399', '#6ee7b7']}
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
          <h1 className="app-header__title">Generator Konfirmasi Utang</h1>
          <p className="app-header__subtitle">
            Aplikasi audit untuk membuat surat konfirmasi utang secara massal, aman, dan 100% di browser.
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
            { step: 2, label: 'Detail Audit' },
            { step: 3, label: 'Penerima & Nominal' },
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

              {/* Step 1: Template Word */}
              <motion.section
                className="section"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <div className="section__header">
                  <span className="section__number">1</span>
                  <div>
                    <h3 className="section__title">Upload Template Dokumen</h3>
                    <p className="section__description">Pilih template surat Word (.docx) dengan placeholder tag</p>
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
                        const file = e.target.files[0];
                        if (file) {
                          setTemplateFile(file);
                          setActiveStep(2);
                          if (errors.templateFile) {
                            setErrors((prev) => {
                              const n = { ...prev };
                              delete n.templateFile;
                              return n;
                            });
                          }
                        }
                      }}
                    />
                    <div className="file-upload__icon">📤</div>
                    <p className="file-upload__text">
                      <strong>Pilih file template</strong> atau drag &amp; drop ke area ini
                    </p>
                    <p className="file-upload__hint">Mendukung format .docx dengan placeholder &#123;&#123;Nama_Penerima&#125;&#125;, &#123;&#123;Nominal&#125;&#125;, dll.</p>
                  </motion.label>

                  {templateFile && (
                    <div className="file-upload__preview">
                      <Icons.File />
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
                    <Icons.Download /> Download Template Word Standar (.docx)
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
                    <h3 className="section__title">Detail Audit &amp; Klien</h3>
                    <p className="section__description">Lengkapi informasi audit yang akan tercetak seragam pada setiap surat</p>
                  </div>
                </div>

                <div className="form-grid mt-3">
                  <div className="form-row">
                    <div className="form-row__item">
                      <label className="form-label">Kota Surat <span className="form-label__required">*</span></label>
                      <input
                        name="Kota"
                        className={`form-input${errors.Kota ? ' form-input--error' : ''}`}
                        placeholder="Contoh: Samarinda"
                        onChange={handleInputChange}
                        value={formData.Kota}
                      />
                      {errors.Kota && <p className="form-error-msg">⚠ {errors.Kota}</p>}
                    </div>

                    <div className="form-row__item">
                      <label className="form-label">Tanggal Surat <span className="form-label__required">*</span></label>
                      <input
                        name="Tanggal_Konfirmasi"
                        type="date"
                        className={`form-input${errors.Tanggal_Konfirmasi ? ' form-input--error' : ''}`}
                        onChange={handleInputChange}
                        value={formData.Tanggal_Konfirmasi}
                      />
                      {formData.Tanggal_Konfirmasi && (
                        <div className="date-preview-badge">
                          <Icons.Calendar /> Pratinjau: <strong>{formatTanggalIndonesia(formData.Tanggal_Konfirmasi)}</strong>
                        </div>
                      )}
                      {errors.Tanggal_Konfirmasi && <p className="form-error-msg">⚠ {errors.Tanggal_Konfirmasi}</p>}
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-row__item">
                      <label className="form-label">Periode Audit</label>
                      <input
                        name="Periode"
                        className="form-input"
                        placeholder="Contoh: 31 Desember 2024"
                        onChange={handleInputChange}
                        value={formData.Periode}
                      />
                      {formData.Periode && formatTanggalIndonesia(formData.Periode) !== formData.Periode && (
                        <div className="date-preview-badge">
                          <Icons.Calendar /> Format Standar: <strong>{formatTanggalIndonesia(formData.Periode)}</strong>
                        </div>
                      )}
                    </div>

                    <div className="form-row__item">
                      <label className="form-label">Batas Waktu Respon</label>
                      <input
                        name="Tanggal_Jatuh_Tempo"
                        type="date"
                        className="form-input"
                        onChange={handleInputChange}
                        value={formData.Tanggal_Jatuh_Tempo}
                      />
                      {formData.Tanggal_Jatuh_Tempo && (
                        <div className="date-preview-badge">
                          <Icons.Calendar /> Pratinjau: <strong>{formatTanggalIndonesia(formData.Tanggal_Jatuh_Tempo)}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-row__item">
                      <label className="form-label">Nama Klien <span className="form-label__required">*</span></label>
                      <input
                        name="Nama_Klien"
                        className={`form-input${errors.Nama_Klien ? ' form-input--error' : ''}`}
                        placeholder="Contoh: PT Mahakam Berjaya Abadi"
                        onChange={handleInputChange}
                        value={formData.Nama_Klien}
                      />
                      {errors.Nama_Klien && <p className="form-error-msg">⚠ {errors.Nama_Klien}</p>}
                    </div>

                    <div className="form-row__item">
                      <label className="form-label">Nominal Fallback / Default <span className="form-label__optional">(Opsional)</span></label>
                      <input
                        name="Nominal_Default"
                        className="form-input"
                        placeholder="Contoh: Rp 10.000.000"
                        onChange={(e) => {
                          const formatted = formatRupiah(e.target.value);
                          setFormData((prev) => ({ ...prev, Nominal_Default: formatted }));
                        }}
                        value={formData.Nominal_Default}
                      />
                      <span className="form-hint">Digunakan jika baris penerima tidak memiliki nominal tersendiri.</span>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-row__item form-row__item--small">
                      <label className="form-label">Sebutan</label>
                      <input
                        name="Sebutan1"
                        className="form-input"
                        placeholder="Bpk / Ibu"
                        onChange={handleInputChange}
                        value={formData.Sebutan1}
                      />
                    </div>
                    <div className="form-row__item form-row__item--large">
                      <label className="form-label">Auditor 1</label>
                      <input
                        name="Auditor1"
                        className="form-input"
                        placeholder="Nama auditor 1"
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
                        placeholder="Ibu / Bpk"
                        onChange={handleInputChange}
                        value={formData.Sebutan2}
                      />
                    </div>
                    <div className="form-row__item form-row__item--large">
                      <label className="form-label">Auditor 2</label>
                      <input
                        name="Auditor2"
                        className="form-input"
                        placeholder="Nama auditor 2"
                        onChange={handleInputChange}
                        value={formData.Auditor2}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-row__item">
                      <label className="form-label">Nama Direktur / Penanda Tangan <span className="form-label__required">*</span></label>
                      <input
                        name="Nama_Direktur"
                        className={`form-input${errors.Nama_Direktur ? ' form-input--error' : ''}`}
                        placeholder="Contoh: H. Bambang Sutrisno"
                        onChange={handleInputChange}
                        value={formData.Nama_Direktur}
                      />
                      {errors.Nama_Direktur && <p className="form-error-msg">⚠ {errors.Nama_Direktur}</p>}
                    </div>
                    <div className="form-row__item" style={{ maxWidth: '220px' }}>
                      <label className="form-label">Jabatan</label>
                      <input
                        name="Jabatan"
                        className="form-input"
                        placeholder="Direktur Utama"
                        onChange={handleInputChange}
                        value={formData.Jabatan}
                      />
                    </div>
                  </div>
                </div>
              </motion.section>

              {/* Step 3: Penerima & Nominal Piutang/Utang */}
              <motion.section
                className="section"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                <div className="section__header">
                  <span className="section__number">3</span>
                  <div>
                    <h3 className="section__title">Daftar Penerima / Kreditur &amp; Nominal</h3>
                    <p className="section__description">Impor data dari Excel, tempel teks batch, atau kelola langsung di tabel</p>
                  </div>
                </div>

                {/* Import Tool Buttons */}
                <div className="recipient-tools mt-3">
                  <label className="btn btn--outline recipient-tools__btn">
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      style={{ display: 'none' }}
                      onChange={handleExcelUpload}
                    />
                    <Icons.Upload /> Upload Data Excel (.xlsx / .xls)
                  </label>

                  <button
                    type="button"
                    className="btn btn--outline recipient-tools__btn"
                    onClick={() => setShowBatchModal((prev) => !prev)}
                  >
                    <Icons.Clipboard /> {showBatchModal ? 'Tutup Input Batch' : 'Paste Teks Batch'}
                  </button>

                  <button
                    type="button"
                    className="btn btn--ghost text-danger recipient-tools__btn--clear"
                    onClick={handleClearTable}
                    title="Kosongkan Tabel"
                  >
                    <Icons.Trash /> Bersihkan Tabel
                  </button>
                </div>

                {/* Batch Paste Drawer / Box */}
                {showBatchModal && (
                  <motion.div
                    className="batch-paste-box mt-3"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <div className="batch-paste-box__header">
                      <strong>Paste Teks Multibaris (Nama &amp; Nominal)</strong>
                      <span className="batch-paste-box__hint">
                        Format: <code>Nama [Tab/Pipa/Koma/TitikKoma] Nominal</code>
                      </span>
                    </div>
                    <textarea
                      className="form-textarea mt-2"
                      placeholder={`Contoh copy-paste dari Excel atau ketik manual:\nPT Sumber Makmur\t15000000\nCV Jaya Abadi | Rp 25.000.000\nBank Mandiri; 50.000.000\nPT Mega Buana, 10000000`}
                      value={batchText}
                      onChange={(e) => setBatchText(e.target.value)}
                      rows={4}
                    />
                    <div className="batch-paste-box__actions mt-2">
                      <button
                        type="button"
                        className="btn btn--primary"
                        onClick={handleApplyBatchText}
                      >
                        <Icons.Plus /> Terapkan ke Tabel
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => setShowBatchModal(false)}
                      >
                        Batal
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Interactive Recipients Table */}
                <div className="recipient-table-container mt-3">
                  <div className="recipient-table-summary">
                    <div className="recipient-table-summary__count">
                      <Icons.Users /> <strong>{validRecipients.length}</strong> Penerima / Kreditur
                    </div>
                    <div className="recipient-table-summary__total">
                      <Icons.Money /> Total Saldo: <strong>Rp {totalNominalSum.toLocaleString('id-ID')}</strong>
                    </div>
                  </div>

                  <table className="recipient-table">
                    <thead>
                      <tr>
                        <th style={{ width: '48px', textAlign: 'center' }}>No</th>
                        <th>Nama Penerima / Kreditur</th>
                        <th style={{ width: '220px' }}>Nominal Utang (Rp)</th>
                        <th style={{ width: '60px', textAlign: 'center' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody ref={tableBodyRef}>
                      {recipients.map((rec, index) => (
                        <tr key={rec.id} className="recipient-table__row">
                          <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                            {index + 1}
                          </td>
                          <td>
                            <input
                              className="recipient-table__input"
                              placeholder="Nama PT / CV / Kreditur / Bank"
                              value={rec.name}
                              onChange={(e) => handleUpdateRow(rec.id, 'name', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              className="recipient-table__input recipient-table__input--money"
                              placeholder={formData.Nominal_Default || 'Rp 0'}
                              value={rec.nominal}
                              onChange={(e) => handleUpdateRow(rec.id, 'nominal', e.target.value)}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="recipient-table__btn-delete"
                              onClick={() => handleDeleteRow(rec.id)}
                              title="Hapus baris ini"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="recipient-table-footer">
                    <button
                      type="button"
                      className="btn btn--outline btn--sm"
                      onClick={handleAddRow}
                    >
                      <Icons.Plus /> Tambah Baris Baru
                    </button>
                  </div>
                </div>

                {errors.penerima && <p className="form-error-msg mt-2">⚠ {errors.penerima}</p>}
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
                    if (window.confirm('Reset semua data kembali ke awal?')) {
                      setTemplateFile(null);
                      setRecipients([{ id: `init_${Date.now()}`, name: '', nominal: '' }]);
                      setBatchText('');
                      setFormData({
                        Kota: '',
                        Tanggal_Konfirmasi: '',
                        Periode: '',
                        Nama_Klien: '',
                        Sebutan1: '',
                        Auditor1: '',
                        Sebutan2: '',
                        Auditor2: '',
                        Tanggal_Jatuh_Tempo: '',
                        Nama_Direktur: '',
                        Jabatan: '',
                        Nominal_Default: ''
                      });
                      setErrors({});
                      setActiveStep(1);
                    }
                  }}
                >
                  Reset Form
                </button>

                <motion.button
                  className="btn btn--primary btn--lg"
                  onClick={generateDocuments}
                  disabled={isProcessing || !templateFile || validRecipients.length === 0}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isProcessing ? (
                    <>
                      <span className="btn__spinner"></span>
                      Sedang Membuat Dokumen...
                    </>
                  ) : (
                    <>
                      <Icons.Sparkles />
                      Generate {validRecipients.length || 1} Surat Konfirmasi Utang
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
                  <h4 className="result-card__title">Surat Berhasil Dibuat! 🎉</h4>
                  <p className="result-card__message">
                    Sebanyak <strong>{downloadData.count}</strong> Surat Konfirmasi Utang telah berhasil digenerate lengkap dengan nominal dan format tanggal standar.
                  </p>
                  <p className="result-card__filename">{downloadData.fileName}</p>
                  <motion.button
                    className="btn btn--success btn--lg"
                    onClick={() => saveAs(downloadData.blob, downloadData.fileName)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Icons.Download /> Unduh Berkas {downloadData.isZip ? 'ZIP' : 'Word (.docx)'}
                  </motion.button>
                </div>
                <div className="action-bar mt-4">
                  <button
                    className="btn btn--ghost"
                    onClick={() => {
                      setHasGenerated(false);
                      setShowConfetti(false);
                    }}
                  >
                    <Icons.ArrowLeft /> Kembali &amp; Buat Lagi
                  </button>
                </div>
              </motion.section>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.main>

      {/* Footer */}
      <footer className="text-center text-muted" style={{ fontSize: '0.8125rem' }}>
        <p>Generator Konfirmasi Utang • KAP Kuncara Budi Santosa &amp; Rekan</p>
      </footer>
    </div>
  );
}

export default App;

