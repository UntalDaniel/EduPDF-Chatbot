import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2, FileText, Download, ArrowLeft, UploadCloud } from 'lucide-react';
import Papa from 'papaparse';

interface QuestionReport {
  enunciado: string;
  respuestaCorrecta?: string;
  distribucion: Record<string, number>;
  total: number;
  aciertos: number;
  porcentajeAcierto: number;
}

const FormDetailScreen: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [report, setReport] = useState<QuestionReport[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);

  useEffect(() => {
    const fetchForm = async () => {
      if (!db || !formId) {
        setError('No se pudo cargar el formato.');
        setLoading(false);
        return;
      }
      try {
        const docRef = doc(db, 'exams', formId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setForm({ id: docSnap.id, ...docSnap.data() });
        } else {
          setError('Formato no encontrado.');
        }
      } catch (err: any) {
        setError('Error al cargar el formato: ' + (err.message || 'Error desconocido.'));
      } finally {
        setLoading(false);
      }
    };
    fetchForm();
  }, [formId]);

  // Generar informe automático al cargar CSV
  useEffect(() => {
    if (!form || !csvHeaders.length || !csvRows.length) {
      setReport([]);
      return;
    }
    // Buscar índice de la primera pregunta (ignorando columnas como "Marca temporal")
    let firstQIndex = 0;
    for (let i = 0; i < csvHeaders.length; i++) {
      if (csvHeaders[i].toLowerCase().includes('pacto') || csvHeaders[i].match(/^\d+\./)) {
        firstQIndex = i;
        break;
      }
    }
    // Generar reporte por pregunta
    const questions = form.questions || [];
    const reportArr: QuestionReport[] = questions.map((q: any, idx: number) => {
      const colIdx = firstQIndex + idx;
      const enunciado = q.text || q.enunciado || csvHeaders[colIdx] || `Pregunta ${idx + 1}`;
      const respuestaCorrecta = q.respuestaCorrecta || q.correct_answer || undefined;
      const distribucion: Record<string, number> = {};
      let aciertos = 0;
      let total = 0;
      csvRows.forEach(row => {
        const resp = (row[colIdx] || '').trim();
        if (resp) {
          distribucion[resp] = (distribucion[resp] || 0) + 1;
          total++;
          if (
            respuestaCorrecta &&
            resp.toLowerCase().replace(/\s+/g, '') === String(respuestaCorrecta).toLowerCase().replace(/\s+/g, '')
          ) {
            aciertos++;
          }
        }
      });
      return {
        enunciado,
        respuestaCorrecta,
        distribucion,
        total,
        aciertos,
        porcentajeAcierto: total > 0 ? Math.round((aciertos / total) * 100) : 0,
      };
    });
    setReport(reportArr);
  }, [csvHeaders, csvRows, form]);

  const handleDownloadCSV = () => {
    if (!csvHeaders.length || !csvRows.length) return;
    const csv = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `respuestas_formato_${formId}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCsvError(null);
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(results.data as any[]);
      },
      error: (err) => {
        setCsvError('Error al procesar el archivo CSV: ' + err.message);
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <Loader2 className="animate-spin h-8 w-8 text-sky-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center">
        <h1 className="text-3xl font-bold mb-3">Error</h1>
        <p className="text-lg mb-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-gray-900 text-slate-100 p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-sky-400 hover:text-sky-200 font-semibold text-lg transition-colors group">
          <ArrowLeft size={22} className="group-hover:-translate-x-1 transition-transform" /> Volver
        </button>
        <h1 className="text-3xl font-bold text-sky-400 flex items-center gap-2 mb-8"><FileText size={32}/> Detalle del Formato</h1>
        <div className="bg-slate-800/60 border border-slate-600/60 rounded-2xl shadow-xl p-6 mb-8 backdrop-blur-md">
          <label className="block mb-4 text-lg font-semibold text-sky-300">Subir archivo CSV exportado de Google Forms:</label>
          <input type="file" accept=".csv" onChange={handleCsvUpload} className="mb-2 block text-slate-200" />
          {csvError && <div className="text-red-400 mb-2">{csvError}</div>}
        </div>
        {csvData.length > 0 && (
          <div className="bg-slate-800/60 border border-slate-600/60 rounded-2xl shadow-xl p-6 backdrop-blur-md">
            <h2 className="text-xl font-bold text-sky-300 mb-4">Retroalimentación del Formato</h2>
            <div className="overflow-x-auto">
              <table className="min-w-[400px] bg-slate-900 rounded-lg">
                <thead>
                  <tr>
                    {Object.keys(csvData[0]).map((col, idx) => (
                      <th key={idx} className="px-4 py-2 text-sky-300">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvData.map((row, i) => (
                    <tr key={i} className="border-t border-slate-700">
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="px-4 py-2 text-slate-100">{val as string}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FormDetailScreen; 