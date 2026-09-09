import { classifyTree } from './backend/src/services/classification/treeClassifier.js';

const mockRootId = '100';
const mockRows = [
  { id: '100', titulo: 'Raiz', depth: 0, has_children: true, ancestor_titles: ['Raiz'] },
  { id: '200', titulo: 'Produto A', depth: 1, has_children: true, ancestor_titles: ['Raiz', 'Produto A'] },
  { id: '300', titulo: 'Subproduto X', depth: 2, has_children: true, ancestor_titles: ['Raiz', 'Produto A', 'Subproduto X'] },
  { id: '400', titulo: 'Categoria 1', depth: 3, has_children: true, ancestor_titles: ['Raiz', 'Produto A', 'Subproduto X', 'Categoria 1'] },
  { id: '500', titulo: 'Mapa A1', depth: 4, has_children: false, ancestor_titles: ['Raiz', 'Produto A', 'Subproduto X', 'Categoria 1', 'Mapa A1'], screens: [{status: 'VALIDADO'}, {status: 'VALIDADO'}] },
  { id: '600', titulo: 'Doc A1', depth: 4, has_children: false, ancestor_titles: ['Raiz', 'Produto A', 'Subproduto X', 'Categoria 1', 'Doc A1'], header: { foo: 'bar' } },
  { id: '700', titulo: 'Vazio', depth: 4, has_children: false, ancestor_titles: ['Raiz', 'Produto A', 'Subproduto X', 'Categoria 1', 'Vazio'] }
];

const result = classifyTree(mockRows, mockRootId);
console.log(JSON.stringify(result, null, 2));
