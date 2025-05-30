import React, { useEffect } from 'react';
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
import { MindMapData } from '../../types/activityTypes';
// @ts-ignore: No type definitions for dagre
import dagre from 'dagre';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface MindMapProps {
  data: MindMapData;
}

const nodeTypes = {
  main: ({ data }: { data: { label: string } }) => (
    <div className="px-6 py-3 bg-purple-100 border-2 border-purple-500 rounded-full shadow-md">
      <div className="font-bold text-purple-800 text-lg">{data.label}</div>
    </div>
  ),
  subtopic: ({ data }: { data: { label: string } }) => (
    <div className="px-4 py-2 bg-blue-100 border-2 border-blue-500 rounded-lg shadow-md">
      <div className="font-medium text-blue-800">{data.label}</div>
    </div>
  ),
  detail: ({ data }: { data: { label: string } }) => (
    <div className="px-3 py-1.5 bg-green-100 border-2 border-green-500 rounded shadow-md">
      <div className="text-sm text-green-800">{data.label}</div>
    </div>
  ),
};

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction: 'TB' | 'LR' = 'TB') => {
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

const getRadialLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  if (nodes.length === 0) return nodes;
  // Nodo principal al centro
  const centerX = 600;
  const centerY = 300;
  const mainNode = nodes.find(n => n.type === 'main') || nodes[0];
  const mainId = mainNode.id;
  const subNodes = nodes.filter(n => n.id !== mainId);
  const radius = 220 + 30 * Math.max(0, subNodes.length - 6); // Aumenta el radio si hay muchos nodos
  const angleStep = (2 * Math.PI) / (subNodes.length || 1);
  return nodes.map((node, i) => {
    if (node.id === mainId) {
      node.position = { x: centerX, y: centerY };
    } else {
      const idx = subNodes.findIndex(n => n.id === node.id);
      node.position = {
        x: centerX + radius * Math.cos(idx * angleStep),
        y: centerY + radius * Math.sin(idx * angleStep),
      };
    }
    return node;
  });
};

const MindMap: React.FC<MindMapProps> = ({ data }) => {
  const validNodeIds = new Set(data.nodes.map(n => n.id));
  const initialNodes: Node[] = data.nodes.map((node: MindMapData['nodes'][0]) => ({
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
    .map((edge: MindMapData['edges'][0]) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#64748b', strokeWidth: 2 },
    }));

  // Layout radial (estrella)
  const layoutedNodes = getRadialLayoutedElements(initialNodes, initialEdges);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(getRadialLayoutedElements(initialNodes, initialEdges));
    setEdges(initialEdges);
    // eslint-disable-next-line
  }, [data]);

  // Botón de descarga
  const handleDownload = async () => {
    const input = document.getElementById('mind-map-download');
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
    pdf.save('mapa-mental.pdf');
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
      <div id="mind-map-download" className="flex-1 w-full h-[600px] overflow-auto">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
};

export default MindMap; 