import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeftIcon, PrinterIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import BarcodeDisplay from '../components/BarcodeDisplay'
import { inventoryApi, getMediaUrl } from '../services/inventoryApi'

export default function PrintLabelPage() {
  const { id } = useParams()
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchItem = async () => {
      try {
        const { data } = await inventoryApi.getItem(id)
        setItem(data)
      } catch (err) {
        toast.error('Error al cargar el artículo')
      } finally {
        setLoading(false)
      }
    }
    fetchItem()
  }, [id])

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return <p className="text-gray-600 p-8">Cargando...</p>
  }

  if (!item) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white print:min-h-0">
      <div className="no-print bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <Link
          to={`/products/${item.id}`}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Volver al artículo
        </Link>
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
        >
          <PrinterIcon className="h-4 w-4" />
          Imprimir etiqueta
        </button>
      </div>

      <div className="p-8 print:p-0">
        <div className="max-w-4xl mx-auto">
          <div className="no-print mb-6 text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-md p-4">
            <p className="font-medium text-blue-900">Instrucciones de impresión</p>
            <ul className="mt-2 list-disc list-inside space-y-1 text-blue-800">
              <li>Configure su impresora a tamaño de etiqueta 4×2 pulgadas o 5×2.5 cm</li>
              <li>Use papel adhesivo resistente para uso industrial</li>
              <li>Verifique que la escala esté al 100% en las opciones de impresión</li>
              <li>Se imprimirán {item.quantity > 1 ? Math.min(item.quantity, 10) : 1} etiquetas para uso múltiple</li>
            </ul>
          </div>

          <div className="space-y-4 print:space-y-0">
            {Array.from({ length: item.quantity > 1 ? Math.min(item.quantity, 10) : 1 }).map((_, idx) => (
              <div
                key={idx}
                className="label-item bg-white border-2 border-dashed border-gray-300 print:border-solid print:border-black mx-auto"
                style={{
                  width: '10cm',
                  height: '5cm',
                  padding: '0.3cm',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: '0.4cm',
                }}
              >
                <div style={{ flex: '0 0 auto', textAlign: 'center' }}>
                  <BarcodeDisplay
                    value={item.barcode_value}
                    height={50}
                    width={1.6}
                    fontSize={11}
                  />
                </div>
                <div style={{ flex: 1, fontFamily: 'monospace', fontSize: '10pt', lineHeight: 1.2, overflow: 'hidden' }}>
                  <p style={{ fontWeight: 'bold', fontSize: '12pt', marginBottom: '2pt' }}>
                    {item.name.length > 30 ? item.name.substring(0, 30) + '…' : item.name}
                  </p>
                  <p style={{ fontSize: '9pt' }}>Cód: <strong>{item.barcode_value}</strong></p>
                  {item.marca && <p style={{ fontSize: '9pt' }}>Marca: {item.marca}</p>}
                  {item.modelo && <p style={{ fontSize: '9pt' }}>Modelo: {item.modelo}</p>}
                  {item.numero_serie && <p style={{ fontSize: '9pt' }}>S/N: {item.numero_serie}</p>}
                  {item.location_breadcrumb && (
                    <p style={{ fontSize: '8pt', marginTop: '2pt', color: '#555' }}>
                      Ubic: {item.location_breadcrumb.length > 40 ? item.location_breadcrumb.substring(0, 40) + '…' : item.location_breadcrumb}
                    </p>
                  )}
                  <p style={{ fontSize: '7pt', marginTop: '2pt', color: '#888' }}>
                    Armada RD · Taller de Electrónica
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            size: 10cm 5cm;
            margin: 0;
          }
          body * { visibility: hidden; }
          .label-item, .label-item * { visibility: visible; }
          .label-item {
            position: absolute;
            top: 0;
            left: 0;
            page-break-after: always;
          }
          .label-item:last-child { page-break-after: auto; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  )
}
