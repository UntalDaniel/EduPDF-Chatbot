import React, { useCallback, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { ConceptMapData } from '../../types/activityTypes';
// @ts-ignore: No type definitions for dagre
import dagre from 'dagre';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface ConceptMapProps {
  data: ConceptMapData;
}

const nodeTypes = {
  concept: ({ data }: { data: { label: string } }) => (
    <div className="px-4 py-2 bg-blue-100 border-2 border-blue-500 rounded-lg shadow-md">
      <div className="font-medium text-blue-800">{data.label}</div>
    </div>
  ),
  subconcept: ({ data }: { data: { label: string } }) => (
    <div className="px-4 py-2 bg-green-100 border-2 border-green-500 rounded-lg shadow-md">
      <div className="font-medium text-green-800">{data.label}</div>
    </div>
  ),
};

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction: 'TB' | 'LR' = 'LR') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 180, height: 60 });
  });
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.position = {
      x: nodeWithPosition.x - 90,
      y: nodeWithPosition.y - 30,
    };
    return node;
  });
};

const ConceptMap: React.FC<ConceptMapProps> = ({ data }) => {
  // DEBUG: Mostrar los datos de entrada
  console.log('ConceptMap DATA:', JSON.stringify(data, null, 2));

  const validNodeIds = new Set(data.nodes.map(n => n.id));
  const initialNodes: Node[] = data.nodes.map(node => ({
    id: node.id,
    type: node.type,
    data: { label: node.label },
    position: { x: 0, y: 0 },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  }));

  // Filtrar edges inválidos
  const initialEdges: Edge[] = data.edges
    .filter(edge =>
      edge.id &&
      edge.source &&
      edge.target &&
      validNodeIds.has(edge.source) &&
      validNodeIds.has(edge.target)
    )
    .map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#64748b', strokeWidth: 2 },
      labelStyle: { fill: '#64748b', fontWeight: 500 }
    }));

  // Elegir dirección según la cantidad de conceptos principales vs subconceptos
  const mainCount = data.nodes.filter(n => n.type === 'concept').length;
  const subCount = data.nodes.filter(n => n.type === 'subconcept').length;
  const direction: 'TB' | 'LR' = mainCount >= subCount ? 'LR' : 'TB';

  // Layout más compacto
  const getLayoutedElementsCompact = (nodes: Node[], edges: Edge[], direction: 'TB' | 'LR' = 'LR') => {
    dagreGraph.setGraph({ 
      rankdir: direction, 
      nodesep: 100, 
      ranksep: 150,
      edgesep: 50,
      marginx: 50,
      marginy: 50
    });
    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, { width: 180, height: 60 });
    });
    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });
    dagre.layout(dagreGraph);
    return nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      node.position = {
        x: nodeWithPosition.x - 90,
        y: nodeWithPosition.y - 30,
      };
      return node;
    });
  };

  const layoutedNodes = getLayoutedElementsCompact(initialNodes, initialEdges, direction);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(getLayoutedElementsCompact(initialNodes, initialEdges, direction));
    setEdges(initialEdges);
    // eslint-disable-next-line
  }, [data]);

  // Botón de descarga
  const handleDownload = async () => {
    const input = document.getElementById('concept-map-download');
    if (!input) return;
    // Calcular el tamaño real del contenido
    const boundingRect = input.getBoundingClientRect();
    const originalWidth = input.scrollWidth;
    const originalHeight = input.scrollHeight;
    // Escalar si es muy grande
    const maxPdfWidth = 1122; // A4 landscape pt
    const maxPdfHeight = 793; // A4 landscape pt
    let scale = 1;
    if (originalWidth > maxPdfWidth || originalHeight > maxPdfHeight) {
      scale = Math.min(maxPdfWidth / originalWidth, maxPdfHeight / originalHeight);
      alert('El mapa es muy grande y será reducido para caber en una página A4.');
    }
    const canvas = await html2canvas(input, { backgroundColor: '#fff', scale: 2 * scale, width: originalWidth, height: originalHeight });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' });
    const pdfWidth = maxPdfWidth;
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight > maxPdfHeight ? maxPdfHeight : pdfHeight);
    pdf.save('mapa-conceptual.pdf');
  };

  return (
    <div className="w-full h-[650px] border border-gray-200 rounded-lg bg-white relative flex flex-col">
      {/* Header fijo para el botón */}
      <div className="sticky top-0 z-10 bg-white flex justify-end p-2 border-b border-gray-200">
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded shadow hover:bg-purple-700 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m0 0l-6-6m6 6l6-6" />
          </svg>
          Descargar PDF
        </button>
      </div>
      {/* Área del mapa con scroll si es necesario */}
      <div id="concept-map-download" className="flex-1 w-full h-[600px] overflow-auto">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          defaultEdgeOptions={{
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#64748b', strokeWidth: 2 }
          }}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
};

export default ConceptMap; 