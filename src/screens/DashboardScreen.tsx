import { FileText, Trash2, Eye, Puzzle } from 'lucide-react';
import { Link } from 'react-router-dom';

              <div className="flex items-center gap-2">
                <Link
                  to={`/dashboard/pdf/${pdf.id}`}
                  className="p-2 text-sky-400 hover:text-sky-300 transition-colors"
                  title="Ver PDF"
                >
                  <Eye size={20} />
                </Link>
                <Link
                  to={`/dashboard/activities/${pdf.id}`}
                  className="p-2 text-green-400 hover:text-green-300 transition-colors"
                  title="Actividades"
                >
                  <Puzzle size={20} />
                </Link>
                <button
                  onClick={() => handleDeletePdf(pdf.id)}
                  className="p-2 text-red-400 hover:text-red-300 transition-colors"
                  title="Eliminar PDF"
                >
                  <Trash2 size={20} />
                </button>
              </div> 