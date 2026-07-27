// Crease Pattern Storage System
class CPStorage {
    constructor() {
        this.storageKey = 'origami_cps';
    }

    saveCP(name, points, lines) {
        const cps = this.getAllCPs();
        
        // Add black frame to the CP
        const framePoints = [
            { x: 0, y: 0 },
            { x: 512, y: 0 },
            { x: 512, y: 512 },
            { x: 0, y: 512 }
        ];
        
        const frameLines = [
            { p1: framePoints[0], p2: framePoints[1], color: 'black' },
            { p1: framePoints[1], p2: framePoints[2], color: 'black' },
            { p1: framePoints[2], p2: framePoints[3], color: 'black' },
            { p1: framePoints[3], p2: framePoints[0], color: 'black' }
        ];
        
        // Merge existing points/lines with frame
        const allPoints = [...points, ...framePoints];
        const allLines = [...lines, ...frameLines];
        
        const cpData = {
            id: Date.now(),
            name: name,
            points: allPoints.map(p => ({x: p.x, y: p.y})),
            lines: allLines.map(l => ({
                p1: {x: l.p1.x, y: l.p1.y},
                p2: {x: l.p2.x, y: l.p2.y},
                color: l.color
            })),
            createdAt: new Date().toISOString()
        };
        cps.push(cpData);
        localStorage.setItem(this.storageKey, JSON.stringify(cps));
        return cpData;
    }

    getAllCPs() {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : [];
    }

    deleteCP(id) {
        const cps = this.getAllCPs();
        const filtered = cps.filter(cp => cp.id !== id);
        localStorage.setItem(this.storageKey, JSON.stringify(filtered));
    }

    getCP(id) {
        const cps = this.getAllCPs();
        return cps.find(cp => cp.id === id);
    }

    parseSVG(svgContent) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgContent, 'image/svg+xml');
        const svgElement = doc.querySelector('svg');
        
        if (!svgElement) {
            throw new Error('Invalid SVG file');
        }

        const points = [];
        const lines = [];
        const pointMap = new Map();

        // Get SVG viewBox to handle coordinates
        const viewBox = svgElement.getAttribute('viewBox');
        let svgWidth = 512, svgHeight = 512;
        if (viewBox) {
            const [, , width, height] = viewBox.split(' ').map(Number);
            svgWidth = width;
            svgHeight = height;
        }

        // Scale factor to fit our 512x512 canvas
        const scaleX = 512 / svgWidth;
        const scaleY = 512 / svgHeight;

        // Process all line elements
        const lineElements = svgElement.querySelectorAll('line');
        lineElements.forEach(line => {
            const x1 = parseFloat(line.getAttribute('x1')) * scaleX;
            const y1 = parseFloat(line.getAttribute('y1')) * scaleY;
            const x2 = parseFloat(line.getAttribute('x2')) * scaleX;
            const y2 = parseFloat(line.getAttribute('y2')) * scaleY;
            
            const stroke = line.getAttribute('stroke') || 'black';
            const color = this.svgColorToInternalColor(stroke);
            
            this.addPointIfNotExists(points, pointMap, x1, y1);
            this.addPointIfNotExists(points, pointMap, x2, y2);
            
            lines.push({
                p1: {x: x1, y: y1},
                p2: {x: x2, y: y2},
                color: color
            });
        });

        // Process all path elements
        const pathElements = svgElement.querySelectorAll('path');
        pathElements.forEach(path => {
            const d = path.getAttribute('d');
            let stroke = path.getAttribute('stroke');
            
            // Handle style attribute
            if (!stroke) {
                const style = path.getAttribute('style');
                if (style) {
                    const strokeMatch = style.match(/stroke:([^;]+)/);
                    if (strokeMatch) {
                        stroke = strokeMatch[1].trim();
                    }
                }
            }
            
            const color = this.svgColorToInternalColor(stroke || 'black');
            
            const pathPoints = this.parsePathData(d, scaleX, scaleY);
            for (let i = 0; i < pathPoints.length - 1; i++) {
                const p1 = pathPoints[i];
                const p2 = pathPoints[i + 1];
                
                this.addPointIfNotExists(points, pointMap, p1.x, p1.y);
                this.addPointIfNotExists(points, pointMap, p2.x, p2.y);
                
                lines.push({
                    p1: {x: p1.x, y: p1.y},
                    p2: {x: p2.x, y: p2.y},
                    color: color
                });
            }
        });

        // Process all polyline elements
        const polylineElements = svgElement.querySelectorAll('polyline');
        polylineElements.forEach(polyline => {
            const pointsAttr = polyline.getAttribute('points');
            const stroke = polyline.getAttribute('stroke') || 'black';
            const color = this.svgColorToInternalColor(stroke);
            
            const polyPoints = this.parsePointsAttribute(pointsAttr, scaleX, scaleY);
            for (let i = 0; i < polyPoints.length - 1; i++) {
                const p1 = polyPoints[i];
                const p2 = polyPoints[i + 1];
                
                this.addPointIfNotExists(points, pointMap, p1.x, p1.y);
                this.addPointIfNotExists(points, pointMap, p2.x, p2.y);
                
                lines.push({
                    p1: {x: p1.x, y: p1.y},
                    p2: {x: p2.x, y: p2.y},
                    color: color
                });
            }
        });

        return { points, lines };
    }

    addPointIfNotExists(points, pointMap, x, y) {
        const key = `${x.toFixed(2)},${y.toFixed(2)}`;
        if (!pointMap.has(key)) {
            points.push({x, y});
            pointMap.set(key, true);
        }
    }

    svgColorToInternalColor(svgColor) {
        // Map common SVG colors to internal colors
        const colorMap = {
            'black': 'black',
            '#000000': 'black',
            'red': 'red',
            '#ff0000': 'red',
            'blue': 'blue',
            '#0000ff': 'blue',
            'rgb(0,0,0)': 'black',
            'rgb(255,0,0)': 'red',
            'rgb(0,0,255)': 'blue'
        };
        
        const lowerColor = svgColor.toLowerCase();
        return colorMap[lowerColor] || 'black';
    }

    parsePathData(d, scaleX, scaleY) {
        const points = [];
        const commands = d.match(/[a-zA-Z][^a-zA-Z]*/g) || [];
        
        let currentX = 0, currentY = 0;
        
        commands.forEach(cmd => {
            const type = cmd[0];
            const args = cmd.slice(1).trim().split(/[\s,]+/).map(Number);
            
            if (type === 'M' || type === 'm') {
                for (let i = 0; i < args.length; i += 2) {
                    if (type === 'M') {
                        currentX = args[i] * scaleX;
                        currentY = args[i + 1] * scaleY;
                    } else {
                        currentX += args[i] * scaleX;
                        currentY += args[i + 1] * scaleY;
                    }
                    points.push({x: currentX, y: currentY});
                }
            } else if (type === 'L' || type === 'l') {
                for (let i = 0; i < args.length; i += 2) {
                    if (type === 'L') {
                        currentX = args[i] * scaleX;
                        currentY = args[i + 1] * scaleY;
                    } else {
                        currentX += args[i] * scaleX;
                        currentY += args[i + 1] * scaleY;
                    }
                    points.push({x: currentX, y: currentY});
                }
            } else if (type === 'H' || type === 'h') {
                args.forEach(arg => {
                    if (type === 'H') {
                        currentX = arg * scaleX;
                    } else {
                        currentX += arg * scaleX;
                    }
                    points.push({x: currentX, y: currentY});
                });
            } else if (type === 'V' || type === 'v') {
                args.forEach(arg => {
                    if (type === 'V') {
                        currentY = arg * scaleY;
                    } else {
                        currentY += arg * scaleY;
                    }
                    points.push({x: currentX, y: currentY});
                });
            }
        });
        
        return points;
    }

    parsePointsAttribute(pointsAttr, scaleX, scaleY) {
        const coords = pointsAttr.trim().split(/[\s,]+/).map(Number);
        const points = [];
        
        for (let i = 0; i < coords.length; i += 2) {
            points.push({
                x: coords[i] * scaleX,
                y: coords[i + 1] * scaleY
            });
        }
        
        return points;
    }

    parseFOLD(foldContent) {
        const fold = JSON.parse(foldContent);
        
        if (!fold.vertices_coords || !fold.edges_vertices) {
            throw new Error('Invalid FOLD file: missing vertices_coords or edges_vertices');
        }

        const points = [];
        const lines = [];
        const pointMap = new Map();

        // Get the coordinate bounds for scaling
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        fold.vertices_coords.forEach(coord => {
            minX = Math.min(minX, coord[0]);
            minY = Math.min(minY, coord[1]);
            maxX = Math.max(maxX, coord[0]);
            maxY = Math.max(maxY, coord[1]);
        });

        const foldWidth = maxX - minX || 1;
        const foldHeight = maxY - minY || 1;
        const scaleX = 512 / foldWidth;
        const scaleY = 512 / foldHeight;

        // Add vertices as points
        fold.vertices_coords.forEach((coord, index) => {
            const x = (coord[0] - minX) * scaleX;
            const y = (coord[1] - minY) * scaleY;
            this.addPointIfNotExists(points, pointMap, x, y);
        });

        // Add edges as lines
        fold.edges_vertices.forEach((edgeVertices, index) => {
            const v1Index = edgeVertices[0];
            const v2Index = edgeVertices[1];
            
            if (v1Index >= fold.vertices_coords.length || v2Index >= fold.vertices_coords.length) {
                return;
            }

            const coord1 = fold.vertices_coords[v1Index];
            const coord2 = fold.vertices_coords[v2Index];
            
            const x1 = (coord1[0] - minX) * scaleX;
            const y1 = (coord1[1] - minY) * scaleY;
            const x2 = (coord2[0] - minX) * scaleX;
            const y2 = (coord2[1] - minY) * scaleY;

            // Get edge assignment for color
            let color = 'black';
            if (fold.edges_assignment && fold.edges_assignment[index]) {
                const assignment = fold.edges_assignment[index];
                switch (assignment) {
                    case 'M': // Mountain
                        color = 'red';
                        break;
                    case 'V': // Valley
                        color = 'blue';
                        break;
                    case 'B': // Border
                    case 'F': // Flat
                    case 'U': // Unassigned
                    default:
                        color = 'black';
                        break;
                }
            }

            lines.push({
                p1: {x: x1, y: y1},
                p2: {x: x2, y: y2},
                color: color
            });
        });

        return { points, lines };
    }
}

// Tree Diagram Node
class TreeNode {
    constructor(x, y, cpId = null) {
        this.x = x;
        this.y = y;
        this.cpId = cpId;
        this.children = [];
        this.parent = null;
        this.id = Date.now() + Math.random();
    }

    addChild(node) {
        node.parent = this;
        this.children.push(node);
    }
}

// Tree Diagram Manager
class TreeDiagram {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.nodes = [];
        this.selectedNode = null;
        this.root = null;
        this.cpStorage = new CPStorage();
        this.isDragging = false;
        this.draggedNode = null;
        this.dragOffset = {x: 0, y: 0};
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const clickedNode = this.findNodeAt(x, y);
        
        if (clickedNode) {
            this.selectedNode = clickedNode;
            this.isDragging = true;
            this.draggedNode = clickedNode;
            this.dragOffset = {
                x: x - clickedNode.x,
                y: y - clickedNode.y
            };
            this.draw();
        }
    }

    handleMouseMove(e) {
        if (this.isDragging && this.draggedNode) {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.draggedNode.x = x - this.dragOffset.x;
            this.draggedNode.y = y - this.dragOffset.y;
            
            // Constrain to canvas bounds
            this.draggedNode.x = Math.max(15, Math.min(this.canvas.width - 15, this.draggedNode.x));
            this.draggedNode.y = Math.max(15, Math.min(this.canvas.height - 15, this.draggedNode.y));
            
            this.draw();
        }
    }

    handleMouseUp(e) {
        this.isDragging = false;
        this.draggedNode = null;
    }

    findNodeAt(x, y) {
        for (const node of this.nodes) {
            const dist = Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2);
            if (dist < 20) {
                return node;
            }
        }
        return null;
    }

    addNode(cpId = null) {
        if (this.nodes.length === 0) {
            // Create root node
            const node = new TreeNode(300, 50, cpId);
            this.nodes.push(node);
            this.root = node;
        } else if (this.selectedNode) {
            // Add child to selected node
            const childCount = this.selectedNode.children.length;
            const x = this.selectedNode.x + (childCount - 0.5) * 100;
            const y = this.selectedNode.y + 100;
            const node = new TreeNode(x, y, cpId);
            this.selectedNode.addChild(node);
            this.nodes.push(node);
        }
        this.draw();
    }

    removeNode() {
        if (this.selectedNode && this.selectedNode !== this.root) {
            // Remove node and its children
            const toRemove = [this.selectedNode];
            let i = 0;
            while (i < toRemove.length) {
                const node = toRemove[i];
                toRemove.push(...node.children);
                i++;
            }
            
            // Remove from parent's children
            if (this.selectedNode.parent) {
                this.selectedNode.parent.children = this.selectedNode.parent.children.filter(
                    child => child !== this.selectedNode
                );
            }
            
            // Remove from nodes array
            this.nodes = this.nodes.filter(node => !toRemove.includes(node));
            this.selectedNode = null;
            this.draw();
        }
    }

    assignCPToNode(cpId) {
        if (this.selectedNode) {
            this.selectedNode.cpId = cpId;
            this.draw();
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw connections
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.nodes.forEach(node => {
            if (node.parent) {
                this.ctx.beginPath();
                this.ctx.moveTo(node.parent.x, node.parent.y);
                this.ctx.lineTo(node.x, node.y);
                this.ctx.stroke();
            }
        });
        
        // Draw nodes
        this.nodes.forEach(node => {
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, 15, 0, Math.PI * 2);
            
            if (node === this.selectedNode) {
                this.ctx.fillStyle = '#00a6ff';
            } else if (node.cpId) {
                this.ctx.fillStyle = '#4CAF50';
            } else {
                this.ctx.fillStyle = '#ccc';
            }
            this.ctx.fill();
            this.ctx.strokeStyle = '#333';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            // Draw CP name if assigned
            if (node.cpId) {
                const cp = this.cpStorage.getCP(node.cpId);
                if (cp) {
                    this.ctx.fillStyle = '#333';
                    this.ctx.font = '10px Arial';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText(cp.name, node.x, node.y + 30);
                }
            }
        });
    }

    getAllCPIds() {
        const cpIds = [];
        const collectCPIds = (node) => {
            if (node.cpId) {
                cpIds.push(node.cpId);
            }
            node.children.forEach(child => collectCPIds(child));
        };
        if (this.root) {
            collectCPIds(this.root);
        }
        return cpIds;
    }
}

// Crease Pattern Merger
class CPMerger {
    constructor() {
        this.cpStorage = new CPStorage();
        this.baseFrame = this.createBaseFrame();
    }

    createBaseFrame() {
        // Create a 512x512 black frame template
        const points = [
            { x: 0, y: 0 },
            { x: 512, y: 0 },
            { x: 512, y: 512 },
            { x: 0, y: 512 }
        ];

        const lines = [
            { p1: points[0], p2: points[1], color: 'black' },   // Top edge
            { p1: points[1], p2: points[2], color: 'black' },   // Right edge
            { p1: points[2], p2: points[3], color: 'black' },   // Bottom edge
            { p1: points[3], p2: points[0], color: 'black' }    // Left edge
        ];

        return { points, lines };
    }

    mergeCPs(cpIds, scale = 1, addIntersections = true, autoFlatFold = false, autoOptimize = false, treeDiagram = null, optimize22_5 = false, usePatternMatching = false, eliminateIntersections = false, enableFlatFoldResize = false) {
        if (cpIds.length === 0) return null;
        
        const mergedPoints = [];
        const mergedLines = [];
        const pointMap = new Map(); // For deduplication
        const cpLinesBySource = []; // Store lines by source CP for intersection detection
        const cpBounds = []; // Store bounds for each CP
        
        // Calculate optimal scale and positions if auto-optimization is enabled
        let optimalScale = scale;
        let optimalPositions = [];
        
        if (autoOptimize) {
            // Use intersection elimination if requested
            if (eliminateIntersections) {
                const optimization = this.optimizeToEliminateIntersections(cpIds, treeDiagram, enableFlatFoldResize);
                optimalScale = optimization.scale;
                optimalPositions = optimization.positions;
            } else {
                const optimization = this.calculateOptimalLayout(cpIds, treeDiagram);
                optimalScale = optimization.scale;
                optimalPositions = optimization.positions;
            }
        }
        
        // Add base frame to merged result
        this.baseFrame.points.forEach(p => {
            const key = `${p.x},${p.y}`;
            if (!pointMap.has(key)) {
                pointMap.set(key, p);
                mergedPoints.push({...p});
            }
        });
        
        this.baseFrame.lines.forEach(l => {
            mergedLines.push({...l});
        });
        
        cpIds.forEach((cpId, index) => {
            const cp = this.cpStorage.getCP(cpId);
            if (!cp) return;
            
            // Calculate bounds for this CP
            const bounds = this.calculateCPBounds(cp);
            cpBounds.push(bounds);
            
            let transformedCP;
            
            // Use pattern matching if enabled
            if (usePatternMatching) {
                const bestMatch = this.findBestMatchPosition(cp);
                if (bestMatch) {
                    transformedCP = this.applyMatchPosition(cp, bestMatch, enableFlatFoldResize);
                } else {
                    // Fall back to regular positioning if no match found
                    transformedCP = this.applyRegularPositioning(cp, index, optimalScale, optimalPositions, autoOptimize, scale, enableFlatFoldResize);
                }
            } else {
                // Use regular positioning
                transformedCP = this.applyRegularPositioning(cp, index, optimalScale, optimalPositions, autoOptimize, scale, enableFlatFoldResize);
            }
            
            const sourceLines = [];
            
            // Add transformed points
            transformedCP.points.forEach(p => {
                const key = `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
                if (!pointMap.has(key)) {
                    pointMap.set(key, p);
                    mergedPoints.push(p);
                }
            });
            
            // Add transformed lines
            transformedCP.lines.forEach(l => {
                const newLine = {
                    p1: l.p1,
                    p2: l.p2,
                    color: l.color,
                    source: cpId
                };
                mergedLines.push(newLine);
                sourceLines.push(newLine);
            });
            
            cpLinesBySource.push(sourceLines);
        });
        
        // Add intersection creases (always enabled now)
        if (cpLinesBySource.length > 1) {
            this.addIntersectionCreases(mergedLines, mergedPoints, pointMap, cpLinesBySource, autoFlatFold);
        }
        
        // Generate ribbon connections if tree diagram is provided
        if (treeDiagram && autoOptimize) {
            this.generateRibbonConnections(mergedLines, mergedPoints, treeDiagram, cpIds);
        }
        
        // Optimize for 22.5-degree system if requested
        let finalLines = mergedLines;
        if (optimize22_5) {
            finalLines = this.optimizeFor22_5System(mergedLines, mergedPoints);
        }
        
        return {
            points: mergedPoints,
            lines: finalLines
        };
    }

    applyRegularPositioning(cp, index, optimalScale, optimalPositions, autoOptimize, scale, enableFlatFold = false) {
        let offsetX, offsetY;
        const currentScale = autoOptimize ? optimalScale : scale;
        
        if (autoOptimize && optimalPositions[index]) {
            offsetX = optimalPositions[index].x;
            offsetY = optimalPositions[index].y;
        } else {
            offsetX = (index % 3) * 170;
            offsetY = Math.floor(index / 3) * 170;
        }
        
        // Separate black frame lines from other lines
        const blackFrameLines = cp.lines.filter(l => 
            l.color === 'black' && 
            this.isFrameLine(l, cp.points)
        );
        const otherLines = cp.lines.filter(l => 
            !blackFrameLines.includes(l)
        );
        
        // Transform non-frame points with offset and scale
        const nonFramePoints = cp.points.filter(p => 
            !this.isFramePoint(p)
        );
        const transformedPoints = nonFramePoints.map(p => ({
            x: (p.x * currentScale) + offsetX,
            y: (p.y * currentScale) + offsetY
        }));
        
        // Transform non-frame lines with offset and scale
        const transformedLines = otherLines.map(l => ({
            p1: {
                x: (l.p1.x * currentScale) + offsetX,
                y: (l.p1.y * currentScale) + offsetY
            },
            p2: {
                x: (l.p2.x * currentScale) + offsetX,
                y: (l.p2.y * currentScale) + offsetY
            },
            color: l.color
        }));
        
        // Add standard black frame (always at 0,0 to 512,512)
        const framePoints = [
            { x: 0, y: 0 },
            { x: 512, y: 0 },
            { x: 512, y: 512 },
            { x: 0, y: 512 }
        ];
        
        const frameLines = [
            { p1: framePoints[0], p2: framePoints[1], color: 'black' },
            { p1: framePoints[1], p2: framePoints[2], color: 'black' },
            { p1: framePoints[2], p2: framePoints[3], color: 'black' },
            { p1: framePoints[3], p2: framePoints[0], color: 'black' }
        ];
        
        // Merge frame with transformed content
        let allPoints = [...transformedPoints, ...framePoints];
        let allLines = [...transformedLines, ...frameLines];
        
        // Add flat-fold lines if enabled
        if (enableFlatFold) {
            const flatFoldLines = this.addFlatFoldLines(allLines, allPoints);
            allLines = [...allLines, ...flatFoldLines];
        }
        
        return {
            points: allPoints,
            lines: allLines
        };
    }

    isFramePoint(p) {
        // Check if point is a frame corner
        const frameCorners = [
            { x: 0, y: 0 },
            { x: 512, y: 0 },
            { x: 512, y: 512 },
            { x: 0, y: 512 }
        ];
        
        const tolerance = 5;
        
        return frameCorners.some(c => 
            Math.abs(p.x - c.x) < tolerance && Math.abs(p.y - c.y) < tolerance
        );
    }

    generateRibbonConnections(mergedLines, mergedPoints, treeDiagram, cpIds) {
        // Identify ribbon regions (parent-child connections in tree)
        const ribbonRegions = this.identifyRibbonRegions(treeDiagram, cpIds);
        
        // Generate connecting creases for each ribbon region
        ribbonRegions.forEach(region => {
            this.generateConnectingCreases(mergedLines, mergedPoints, region);
        });
    }

    identifyRibbonRegions(treeDiagram, cpIds) {
        const regions = [];
        
        // Find parent-child relationships in the tree
        treeDiagram.nodes.forEach(node => {
            if (node.parent && node.cpId && node.parent.cpId) {
                const parentIndex = cpIds.indexOf(node.parent.cpId);
                const childIndex = cpIds.indexOf(node.cpId);
                
                if (parentIndex !== -1 && childIndex !== -1) {
                    regions.push({
                        parentCPId: node.parent.cpId,
                        childCPId: node.cpId,
                        parentIndex: parentIndex,
                        childIndex: childIndex,
                        parentPos: { x: node.parent.x, y: node.parent.y },
                        childPos: { x: node.x, y: node.y }
                    });
                }
            }
        });
        
        return regions;
    }

    generateConnectingCreases(mergedLines, mergedPoints, region) {
        // Find boundary points of parent and child CPs
        const parentBoundary = this.findCPBoundaryPoints(mergedLines, mergedPoints, region.parentCPId);
        const childBoundary = this.findCPBoundaryPoints(mergedLines, mergedPoints, region.childCPId);
        
        if (parentBoundary.length === 0 || childBoundary.length === 0) {
            return;
        }
        
        // Find closest points between parent and child
        const closestPair = this.findClosestPoints(parentBoundary, childBoundary);
        
        if (!closestPair) {
            return;
        }
        
        // Generate connecting creases using 22.5-degree system
        this.generateFoldableConnections(mergedLines, mergedPoints, closestPair, region);
    }

    findCPBoundaryPoints(mergedLines, mergedPoints, cpId) {
        const boundaryPoints = [];
        
        // Find points that belong to this CP and are on the boundary
        mergedLines.forEach(line => {
            if (line.source === cpId && line.color === 'black') {
                // Add endpoints if they're boundary points
                if (!this.pointExists(boundaryPoints, line.p1)) {
                    boundaryPoints.push(line.p1);
                }
                if (!this.pointExists(boundaryPoints, line.p2)) {
                    boundaryPoints.push(line.p2);
                }
            }
        });
        
        return boundaryPoints;
    }

    pointExists(points, point) {
        return points.some(p => 
            Math.abs(p.x - point.x) < 1 && Math.abs(p.y - point.y) < 1
        );
    }

    findClosestPoints(points1, points2) {
        let minDist = Infinity;
        let closestPair = null;
        
        points1.forEach(p1 => {
            points2.forEach(p2 => {
                const dist = Math.sqrt(
                    Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
                );
                
                if (dist < minDist) {
                    minDist = dist;
                    closestPair = { p1, p2, distance: dist };
                }
            });
        });
        
        return closestPair;
    }

    generateFoldableConnections(mergedLines, mergedPoints, closestPair, region) {
        const { p1, p2 } = closestPair;
        
        // Generate intermediate points using 22.5-degree angles
        const angles = [0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5];
        const connectionPoints = [p1];
        
        // Calculate direction vector
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const baseAngle = Math.atan2(dy, dx) * (180 / Math.PI);
        
        // Find closest 22.5-degree angle
        let closestAngle = angles[0];
        let minAngleDiff = Math.abs(baseAngle - closestAngle);
        
        angles.forEach(angle => {
            const diff = Math.abs(baseAngle - angle);
            if (diff < minAngleDiff) {
                minAngleDiff = diff;
                closestAngle = angle;
            }
        });
        
        // Generate intermediate points along the path
        const numSegments = Math.ceil(distance / 50); // Segment every 50 pixels
        const segmentLength = distance / numSegments;
        const angleRad = closestAngle * (Math.PI / 180);
        
        for (let i = 1; i < numSegments; i++) {
            const intermediatePoint = {
                x: p1.x + (segmentLength * i) * Math.cos(angleRad),
                y: p1.y + (segmentLength * i) * Math.sin(angleRad)
            };
            
            // Add point if it doesn't exist
            const key = `${intermediatePoint.x.toFixed(2)},${intermediatePoint.y.toFixed(2)}`;
            const pointExists = mergedPoints.some(p => 
                Math.abs(p.x - intermediatePoint.x) < 1 && Math.abs(p.y - intermediatePoint.y) < 1
            );
            
            if (!pointExists) {
                mergedPoints.push(intermediatePoint);
            }
            
            connectionPoints.push(intermediatePoint);
        }
        
        connectionPoints.push(p2);
        
        // Create connecting lines
        for (let i = 0; i < connectionPoints.length - 1; i++) {
            const line = {
                p1: connectionPoints[i],
                p2: connectionPoints[i + 1],
                color: 'black', // Ribbon connections are typically black (boundary)
                source: 'ribbon'
            };
            
            // Check if line already exists
            const lineExists = mergedLines.some(l => 
                this.linesEqual(l, line)
            );
            
            if (!lineExists) {
                mergedLines.push(line);
            }
        }
    }

    linesEqual(line1, line2) {
        return (
            (Math.abs(line1.p1.x - line2.p1.x) < 1 && Math.abs(line1.p1.y - line2.p1.y) < 1 &&
             Math.abs(line1.p2.x - line2.p2.x) < 1 && Math.abs(line1.p2.y - line2.p2.y) < 1) ||
            (Math.abs(line1.p1.x - line2.p2.x) < 1 && Math.abs(line1.p1.y - line2.p2.y) < 1 &&
             Math.abs(line1.p2.x - line2.p1.x) < 1 && Math.abs(line1.p2.y - line2.p1.y) < 1)
        );
    }

    // Check if two lines are collinear (on the same infinite line)
    areLinesCollinear(line1, line2, tolerance = 0.001) {
        const dx1 = line1.p2.x - line1.p1.x;
        const dy1 = line1.p2.y - line1.p1.y;
        const dx2 = line2.p2.x - line2.p1.x;
        const dy2 = line2.p2.y - line2.p1.y;
        
        // Check if cross product is close to zero (lines are parallel)
        const crossProduct = dx1 * dy2 - dy1 * dx2;
        if (Math.abs(crossProduct) > tolerance) {
            return false;
        }
        
        // Check if line2.p1 is on line1's infinite line
        const dx3 = line2.p1.x - line1.p1.x;
        const dy3 = line2.p1.y - line1.p1.y;
        const crossProduct2 = dx1 * dy3 - dy1 * dx3;
        
        return Math.abs(crossProduct2) < tolerance;
    }

    // Check if two collinear lines overlap
    doCollinearLinesOverlap(line1, line2) {
        // Project points onto the line
        const dx = line1.p2.x - line1.p1.x;
        const dy = line1.p2.y - line1.p1.y;
        const lengthSquared = dx * dx + dy * dy;
        
        if (lengthSquared === 0) {
            // Both lines are points
            return Math.abs(line1.p1.x - line2.p1.x) < 1 && Math.abs(line1.p1.y - line2.p1.y) < 1;
        }
        
        // Project line2 points onto line1
        const project = (p) => {
            const t = ((p.x - line1.p1.x) * dx + (p.y - line1.p1.y) * dy) / lengthSquared;
            return t;
        };
        
        const t2a = project(line2.p1);
        const t2b = project(line2.p2);
        const t1a = 0;
        const t1b = 1;
        
        // Check if intervals overlap
        const min1 = Math.min(t1a, t1b);
        const max1 = Math.max(t1a, t1b);
        const min2 = Math.min(t2a, t2b);
        const max2 = Math.max(t2a, t2b);
        
        return !(max1 < min2 || max2 < min1);
    }

    // Check if two lines intersect (excluding collinear/overlapping cases)
    linesIntersect(line1, line2, tolerance = 0.001) {
        // Check if lines are collinear
        if (this.areLinesCollinear(line1, line2, tolerance)) {
            return false; // Collinear lines are not considered intersecting
        }
        
        // Use existing line intersection logic
        const intersection = this.getLineIntersection(line1.p1, line1.p2, line2.p1, line2.p2);
        return intersection !== null;
    }

    // Check if current layout has any intersections
    hasIntersections(lines) {
        for (let i = 0; i < lines.length; i++) {
            for (let j = i + 1; j < lines.length; j++) {
                if (this.linesIntersect(lines[i], lines[j])) {
                    return true;
                }
            }
        }
        return false;
    }

    // Iterative optimization to eliminate intersections
    optimizeToEliminateIntersections(cpIds, treeDiagram = null, enableFlatFold = false) {
        const maxIterations = 100;
        let iteration = 0;
        let bestLayout = null;
        let bestIntersectionCount = Infinity;
        
        // Start with current optimal layout
        let currentLayout = this.calculateOptimalLayout(cpIds, treeDiagram);
        
        while (iteration < maxIterations) {
            // Merge with current layout and flat-fold consideration
            const merged = this.mergeCPs(cpIds, currentLayout.scale, true, false, false, treeDiagram, false, false, false, enableFlatFold);
            
            if (!merged) {
                break;
            }
            
            // Count intersections
            const intersectionCount = this.countIntersections(merged.lines);
            
            if (intersectionCount < bestIntersectionCount) {
                bestIntersectionCount = intersectionCount;
                bestLayout = { ...currentLayout };
                
                // If no intersections, we're done
                if (intersectionCount === 0) {
                    break;
                }
            }
            
            // Try to adjust positions to reduce intersections
            currentLayout = this.adjustPositionsToReduceIntersections(cpIds, currentLayout, merged.lines);
            
            iteration++;
        }
        
        return bestLayout || currentLayout;
    }

    countIntersections(lines) {
        let count = 0;
        for (let i = 0; i < lines.length; i++) {
            for (let j = i + 1; j < lines.length; j++) {
                if (this.linesIntersect(lines[i], lines[j])) {
                    count++;
                }
            }
        }
        return count;
    }

    adjustPositionsToReduceIntersections(cpIds, currentLayout, lines) {
        // Adjust both positions and scale to reduce intersections
        const adjustedPositions = currentLayout.positions.map(pos => ({
            x: pos.x + (Math.random() - 0.5) * 20, // Small random adjustment
            y: pos.y + (Math.random() - 0.5) * 20
        }));
        
        // Adjust scale slightly (between 0.5 and 1.5 of current scale)
        const scaleAdjustment = 0.9 + Math.random() * 0.2; // 0.9 to 1.1
        const adjustedScale = currentLayout.scale * scaleAdjustment;
        
        return {
            scale: adjustedScale,
            positions: adjustedPositions
        };
    }

    calculateCPBounds(cp) {
        if (cp.points.length === 0) {
            return { minX: 0, minY: 0, maxX: 512, maxY: 512, width: 512, height: 512 };
        }
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        cp.points.forEach(p => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        });
        
        return {
            minX, minY, maxX, maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    calculateOptimalLayout(cpIds, treeDiagram = null) {
        const cps = cpIds.map(cpId => this.cpStorage.getCP(cpId));
        const bounds = cps.map(cp => this.calculateCPBounds(cp));
        const blackLineAnalyses = cps.map(cp => this.getBlackLineAnalysis(cp));
        
        // Check for corner-suitable CPs and validate count
        const cornerSuitableCPs = blackLineAnalyses.filter(analysis => analysis.isCornerSuitable);
        if (cornerSuitableCPs.length > 5) {
            throw new Error('角に配置する展開図が5個を超えています。実行できません。');
        }
        
        // Calculate total area needed, weighted by black line complexity
        let totalWidth = 0;
        let totalHeight = 0;
        
        bounds.forEach((bound, index) => {
            const complexity = blackLineAnalyses[index].complexity;
            const complexityFactor = 1 + (complexity / 1000); // Higher complexity = more space needed
            totalWidth += bound.width * complexityFactor;
            totalHeight += bound.height * complexityFactor;
        });
        
        // Calculate optimal scale to fit in 512x512 canvas
        const maxDimension = Math.max(totalWidth, totalHeight);
        const optimalScale = Math.min(512 / maxDimension, 1.5); // Cap at 1.5x
        
        // Separate CPs into corner-suitable, edge-suitable, and regular
        const cornerCPs = [];
        const edgeCPs = [];
        const regularCPs = [];
        
        blackLineAnalyses.forEach((analysis, index) => {
            if (analysis.isCornerSuitable) {
                cornerCPs.push(index);
            } else if (analysis.isEdgeSuitable) {
                edgeCPs.push(index);
            } else {
                regularCPs.push(index);
            }
        });
        
        // Consider tree node positions if available
        const nodePositions = treeDiagram ? this.getTreeNodePositions(treeDiagram, cpIds) : null;
        
        // Calculate positions
        const positions = [];
        
        // Position corner CPs at corners (max 4 corners, distribute extras along edges)
        this.positionCornerCPs(cornerCPs, positions, bounds, optimalScale, nodePositions);
        
        // Position edge CPs along edges
        this.positionEdgeCPs(edgeCPs, positions, bounds, optimalScale, cornerCPs.length, nodePositions);
        
        // Position regular CPs in remaining space using grid layout
        this.positionRegularCPs(regularCPs, positions, bounds, optimalScale, cornerCPs.length + edgeCPs.length, nodePositions);
        
        return {
            scale: optimalScale,
            positions: positions
        };
    }

    positionCornerCPs(cornerCPs, positions, bounds, scale, nodePositions) {
        const corners = [
            { x: 0, y: 0 },           // Top-left
            { x: 512, y: 0 },         // Top-right
            { x: 512, y: 512 },       // Bottom-right
            { x: 0, y: 512 }          // Bottom-left
        ];
        
        cornerCPs.forEach((cpIndex, i) => {
            const cornerIndex = i % 4;
            const corner = corners[cornerIndex];
            const bound = bounds[cpIndex];
            
            const scaledWidth = bound.width * scale;
            const scaledHeight = bound.height * scale;
            
            // Adjust position based on corner
            let x, y;
            if (cornerIndex === 0) { // Top-left
                x = corner.x + 10;
                y = corner.y + 10;
            } else if (cornerIndex === 1) { // Top-right
                x = corner.x - scaledWidth - 10;
                y = corner.y + 10;
            } else if (cornerIndex === 2) { // Bottom-right
                x = corner.x - scaledWidth - 10;
                y = corner.y - scaledHeight - 10;
            } else { // Bottom-left
                x = corner.x + 10;
                y = corner.y - scaledHeight - 10;
            }
            
            positions[cpIndex] = { x, y };
        });
    }

    positionEdgeCPs(edgeCPs, positions, bounds, scale, cornerCount, nodePositions) {
        const edges = [
            { start: { x: 0, y: 0 }, end: { x: 512, y: 0 }, direction: 'horizontal' },     // Top
            { start: { x: 512, y: 0 }, end: { x: 512, y: 512 }, direction: 'vertical' },   // Right
            { start: { x: 512, y: 512 }, end: { x: 0, y: 512 }, direction: 'horizontal' }, // Bottom
            { start: { x: 0, y: 512 }, end: { x: 0, y: 0 }, direction: 'vertical' }         // Left
        ];
        
        edgeCPs.forEach((cpIndex, i) => {
            const edgeIndex = i % 4;
            const edge = edges[edgeIndex];
            const bound = bounds[cpIndex];
            
            const scaledWidth = bound.width * scale;
            const scaledHeight = bound.height * scale;
            
            // Calculate position along edge, avoiding corners
            const edgeLength = 512;
            const availableSpace = edgeLength - (cornerCount > 0 ? 100 : 0); // Reserve space for corners
            const segmentSize = availableSpace / (Math.ceil(edgeCPs.length / 4) + 1);
            const offset = segmentSize * (Math.floor(i / 4) + 1) + (cornerCount > 0 ? 50 : 0);
            
            let x, y;
            if (edge.direction === 'horizontal') {
                x = offset;
                y = edgeIndex === 0 ? 10 : 512 - scaledHeight - 10;
            } else {
                x = edgeIndex === 1 ? 512 - scaledWidth - 10 : 10;
                y = offset;
            }
            
            positions[cpIndex] = { x, y };
        });
    }

    positionRegularCPs(regularCPs, positions, bounds, scale, reservedCount, nodePositions) {
        if (regularCPs.length === 0) return;
        
        // Calculate available space (center area)
        const margin = 100;
        const availableWidth = 512 - margin * 2;
        const availableHeight = 512 - margin * 2;
        
        // Grid layout for regular CPs
        const cols = Math.ceil(Math.sqrt(regularCPs.length));
        const rows = Math.ceil(regularCPs.length / cols);
        
        const cellWidth = availableWidth / cols;
        const cellHeight = availableHeight / rows;
        
        regularCPs.forEach((cpIndex, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            
            const bound = bounds[cpIndex];
            const scaledWidth = bound.width * scale;
            const scaledHeight = bound.height * scale;
            
            positions[cpIndex] = {
                x: margin + col * cellWidth + (cellWidth - scaledWidth) / 2,
                y: margin + row * cellHeight + (cellHeight - scaledHeight) / 2
            };
        });
    }

    getTreeNodePositions(treeDiagram, cpIds) {
        // Get tree node positions for the given CP IDs
        const nodePositions = {};
        treeDiagram.nodes.forEach(node => {
            if (node.cpId && cpIds.includes(node.cpId)) {
                const index = cpIds.indexOf(node.cpId);
                nodePositions[index] = { x: node.x, y: node.y };
            }
        });
        return nodePositions;
    }

    // 22.5-degree system utilities
    is22_5DegreeAngle(angle) {
        // Normalize angle to 0-180 range
        const normalizedAngle = Math.abs(angle) % 180;
        // Check if angle is close to a multiple of 22.5 degrees
        const targetAngles = [0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5];
        return targetAngles.some(target => 
            Math.abs(normalizedAngle - target) < 2 // Allow 2 degree tolerance
        );
    }

    snapTo22_5Degrees(angle) {
        // Normalize angle to 0-180 range
        let normalizedAngle = Math.abs(angle) % 180;
        
        // Find closest 22.5-degree multiple
        const targetAngles = [0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180];
        let closestAngle = targetAngles[0];
        let minDiff = Math.abs(normalizedAngle - closestAngle);
        
        targetAngles.forEach(target => {
            const diff = Math.abs(normalizedAngle - target);
            if (diff < minDiff) {
                minDiff = diff;
                closestAngle = target;
            }
        });
        
        // Preserve original sign
        return angle >= 0 ? closestAngle : -closestAngle;
    }

    getLineAngle(line) {
        const dx = line.p2.x - line.p1.x;
        const dy = line.p2.y - line.p1.y;
        return Math.atan2(dy, dx) * (180 / Math.PI);
    }

    optimizeFor22_5System(mergedLines, mergedPoints) {
        // Optimize line angles to align with 22.5-degree system
        const optimizedLines = mergedLines.map(line => {
            const angle = this.getLineAngle(line);
            const length = Math.sqrt(
                Math.pow(line.p2.x - line.p1.x, 2) + 
                Math.pow(line.p2.y - line.p1.y, 2)
            );
            
            // Snap angle to nearest 22.5-degree multiple
            const snappedAngle = this.snapTo22_5Degrees(angle);
            const snappedAngleRad = snappedAngle * (Math.PI / 180);
            
            // Calculate new endpoint
            const newP2 = {
                x: line.p1.x + length * Math.cos(snappedAngleRad),
                y: line.p1.y + length * Math.sin(snappedAngleRad)
            };
            
            return {
                p1: line.p1,
                p2: newP2,
                color: line.color,
                source: line.source
            };
        });
        
        return optimizedLines;
    }

    // Black line pattern matching
    findBlackLineMatches(cp) {
        const blackLines = cp.lines.filter(line => line.color === 'black');
        const frameLines = this.baseFrame.lines;
        
        if (blackLines.length === 0) {
            return [];
        }
        
        // Test all possible combinations of black lines with frame lines
        const candidateMatches = [];
        
        // Test all rotations
        const rotations = [0, 90, 180, 270];
        
        rotations.forEach(rotation => {
            // For each rotation, try to match each black line with each frame line
            blackLines.forEach(cpLine => {
                frameLines.forEach(frameLine => {
                    const match = this.tryLineMatch(cpLine, frameLine, rotation);
                    if (match) {
                        // Calculate how many other black lines also match with this offset/rotation
                        const matchingCount = this.countMatchingLines(blackLines, frameLines, match.offset, rotation);
                        
                        candidateMatches.push({
                            offset: match.offset,
                            rotation: rotation,
                            matchingCount: matchingCount,
                            score: matchingCount // Score based on number of matching lines
                        });
                    }
                });
            });
        });
        
        // Remove duplicates (same offset and rotation)
        const uniqueMatches = [];
        const seen = new Set();
        
        candidateMatches.forEach(match => {
            const key = `${match.offset.x.toFixed(2)},${match.offset.y.toFixed(2)},${match.rotation}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueMatches.push(match);
            }
        });
        
        return uniqueMatches;
    }

    countMatchingLines(blackLines, frameLines, offset, rotation) {
        let count = 0;
        const tolerance = 5;
        
        blackLines.forEach(cpLine => {
            const rotatedCPLine = this.rotateLine(cpLine, rotation);
            
            frameLines.forEach(frameLine => {
                // Check if this line matches with the given offset
                const p1Match = Math.abs(rotatedCPLine.p1.x + offset.x - frameLine.p1.x) < tolerance && 
                               Math.abs(rotatedCPLine.p1.y + offset.y - frameLine.p1.y) < tolerance;
                const p2Match = Math.abs(rotatedCPLine.p1.x + offset.x - frameLine.p2.x) < tolerance && 
                               Math.abs(rotatedCPLine.p1.y + offset.y - frameLine.p2.y) < tolerance;
                const p3Match = Math.abs(rotatedCPLine.p2.x + offset.x - frameLine.p1.x) < tolerance && 
                               Math.abs(rotatedCPLine.p2.y + offset.y - frameLine.p1.y) < tolerance;
                const p4Match = Math.abs(rotatedCPLine.p2.x + offset.x - frameLine.p2.x) < tolerance && 
                               Math.abs(rotatedCPLine.p2.y + offset.y - frameLine.p2.y) < tolerance;
                
                if (p1Match || p2Match || p3Match || p4Match) {
                    count++;
                }
            });
        });
        
        return count;
    }

    tryLineMatch(cpLine, frameLine, rotation) {
        // Try to match cpLine with frameLine for a specific rotation
        const tolerance = 5; // Pixel tolerance for matching
        
        const rotatedCPLine = this.rotateLine(cpLine, rotation);
        
        // Try matching p1 to p1
        const offset1 = {
            x: frameLine.p1.x - rotatedCPLine.p1.x,
            y: frameLine.p1.y - rotatedCPLine.p1.y
        };
        
        // Check if at least one endpoint matches (corner matching)
        const p1Match = Math.abs(rotatedCPLine.p1.x + offset1.x - frameLine.p1.x) < tolerance && 
                       Math.abs(rotatedCPLine.p1.y + offset1.y - frameLine.p1.y) < tolerance;
        
        if (p1Match) {
            return {
                offset: offset1,
                rotation: rotation,
                score: 1.0
            };
        }
        
        // Try matching p1 to p2
        const offset2 = {
            x: frameLine.p2.x - rotatedCPLine.p1.x,
            y: frameLine.p2.y - rotatedCPLine.p1.y
        };
        
        const p2Match = Math.abs(rotatedCPLine.p1.x + offset2.x - frameLine.p2.x) < tolerance && 
                       Math.abs(rotatedCPLine.p1.y + offset2.y - frameLine.p2.y) < tolerance;
        
        if (p2Match) {
            return {
                offset: offset2,
                rotation: rotation,
                score: 1.0
            };
        }
        
        // Try matching p2 to p1
        const offset3 = {
            x: frameLine.p1.x - rotatedCPLine.p2.x,
            y: frameLine.p1.y - rotatedCPLine.p2.y
        };
        
        const p3Match = Math.abs(rotatedCPLine.p2.x + offset3.x - frameLine.p1.x) < tolerance && 
                       Math.abs(rotatedCPLine.p2.y + offset3.y - frameLine.p1.y) < tolerance;
        
        if (p3Match) {
            return {
                offset: offset3,
                rotation: rotation,
                score: 1.0
            };
        }
        
        // Try matching p2 to p2
        const offset4 = {
            x: frameLine.p2.x - rotatedCPLine.p2.x,
            y: frameLine.p2.y - rotatedCPLine.p2.y
        };
        
        const p4Match = Math.abs(rotatedCPLine.p2.x + offset4.x - frameLine.p2.x) < tolerance && 
                       Math.abs(rotatedCPLine.p2.y + offset4.y - frameLine.p2.y) < tolerance;
        
        if (p4Match) {
            return {
                offset: offset4,
                rotation: rotation,
                score: 1.0
            };
        }
        
        return null;
    }

    rotateLine(line, degrees) {
        const radians = degrees * (Math.PI / 180);
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        
        // Rotate around origin (0,0)
        const rotatePoint = (p) => ({
            x: p.x * cos - p.y * sin,
            y: p.x * sin + p.y * cos
        });
        
        return {
            p1: rotatePoint(line.p1),
            p2: rotatePoint(line.p2),
            color: line.color
        };
    }

    findBestMatchPosition(cp) {
        const matches = this.findBlackLineMatches(cp);
        
        if (matches.length === 0) {
            return null;
        }
        
        // Find the best match (highest matchingCount = most black lines matching frame)
        let bestMatch = matches[0];
        matches.forEach(match => {
            if (match.matchingCount > bestMatch.matchingCount) {
                bestMatch = match;
            }
        });
        
        return bestMatch;
    }

    applyMatchPosition(cp, match, enableFlatFold = false) {
        const radians = match.rotation * (Math.PI / 180);
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        
        // Transform all points and lines (including black frame)
        const transformedPoints = cp.points.map(p => {
            // Rotate
            const rotatedX = p.x * cos - p.y * sin;
            const rotatedY = p.x * sin + p.y * cos;
            
            // Translate
            return {
                x: rotatedX + match.offset.x,
                y: rotatedY + match.offset.y
            };
        });
        
        // Transform all lines
        const transformedLines = cp.lines.map(l => {
            const rotatedP1 = {
                x: l.p1.x * cos - l.p1.y * sin,
                y: l.p1.x * sin + l.p1.y * cos
            };
            const rotatedP2 = {
                x: l.p2.x * cos - l.p2.y * sin,
                y: l.p2.x * sin + l.p2.y * cos
            };
            
            return {
                p1: {
                    x: rotatedP1.x + match.offset.x,
                    y: rotatedP1.y + match.offset.y
                },
                p2: {
                    x: rotatedP2.x + match.offset.x,
                    y: rotatedP2.y + match.offset.y
                },
                color: l.color
            };
        });
        
        let allPoints = [...transformedPoints];
        let allLines = [...transformedLines];
        
        // Add flat-fold lines if enabled
        if (enableFlatFold) {
            const flatFoldLines = this.addFlatFoldLines(allLines, allPoints);
            allLines = [...allLines, ...flatFoldLines];
        }
        
        return {
            points: allPoints,
            lines: allLines
        };
    }

    addFlatFoldLines(lines, points) {
        const newLines = [];
        const pointMap = new Map();
        
        // Build point map for deduplication
        points.forEach(p => {
            const key = `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
            pointMap.set(key, p);
        });
        
        // Add intersection creases between same-colored lines
        for (let i = 0; i < lines.length; i++) {
            for (let j = i + 1; j < lines.length; j++) {
                const line1 = lines[i];
                const line2 = lines[j];
                
                // Only add intersections for same-colored lines
                if (line1.color === line2.color) {
                    const intersection = this.getLineIntersection(line1.p1, line1.p2, line2.p1, line2.p2);
                    if (intersection) {
                        // Check if intersection point already exists
                        const key = `${intersection.x.toFixed(2)},${intersection.y.toFixed(2)}`;
                        if (!pointMap.has(key)) {
                            pointMap.set(key, intersection);
                            points.push(intersection);
                        }
                        
                        // Add crease lines from intersection to line endpoints
                        newLines.push({
                            p1: line1.p1,
                            p2: intersection,
                            color: line1.color
                        });
                        newLines.push({
                            p1: line1.p2,
                            p2: intersection,
                            color: line1.color
                        });
                        newLines.push({
                            p1: line2.p1,
                            p2: intersection,
                            color: line2.color
                        });
                        newLines.push({
                            p1: line2.p2,
                            p2: intersection,
                            color: line2.color
                        });
                    }
                }
            }
        }
        
        return newLines;
    }

    isFrameLine(line, points) {
        // Check if line is part of the 512x512 frame
        const frameCorners = [
            { x: 0, y: 0 },
            { x: 512, y: 0 },
            { x: 512, y: 512 },
            { x: 0, y: 512 }
        ];
        
        const tolerance = 5;
        
        // Check if both endpoints are frame corners
        const p1IsCorner = frameCorners.some(c => 
            Math.abs(line.p1.x - c.x) < tolerance && Math.abs(line.p1.y - c.y) < tolerance
        );
        const p2IsCorner = frameCorners.some(c => 
            Math.abs(line.p2.x - c.x) < tolerance && Math.abs(line.p2.y - c.y) < tolerance
        );
        
        return p1IsCorner && p2IsCorner;
    }

    groupCPsByColor(cps) {
        const groups = {
            'black': [],
            'red': [],
            'blue': []
        };
        
        cps.forEach((cp, index) => {
            const dominantColor = this.getDominantColor(cp);
            if (groups[dominantColor]) {
                groups[dominantColor].push(index);
            } else {
                groups['black'].push(index); // Default to black
            }
        });
        
        // Return only non-empty groups
        return Object.values(groups).filter(group => group.length > 0);
    }

    getDominantColor(cp) {
        if (!cp.lines || cp.lines.length === 0) return 'black';
        
        const colorCounts = {
            'black': 0,
            'red': 0,
            'blue': 0
        };
        
        cp.lines.forEach(line => {
            if (colorCounts[line.color] !== undefined) {
                colorCounts[line.color]++;
            }
        });
        
        // Find the color with the most lines
        let maxCount = 0;
        let dominantColor = 'black';
        
        for (const color in colorCounts) {
            if (colorCounts[color] > maxCount) {
                maxCount = colorCounts[color];
                dominantColor = color;
            }
        }
        
        return dominantColor;
    }

    getBlackLineAnalysis(cp) {
        if (!cp.lines || cp.lines.length === 0) {
            return {
                count: 0,
                totalLength: 0,
                avgLength: 0,
                complexity: 0,
                isBlackLineCP: false,
                isCornerSuitable: false,
                isEdgeSuitable: false
            };
        }
        
        const blackLines = cp.lines.filter(line => line.color === 'black');
        const count = blackLines.length;
        
        if (count === 0) {
            return {
                count: 0,
                totalLength: 0,
                avgLength: 0,
                complexity: 0,
                isBlackLineCP: false,
                isCornerSuitable: false,
                isEdgeSuitable: false
            };
        }
        
        // Calculate total and average length of black lines
        let totalLength = 0;
        blackLines.forEach(line => {
            const length = Math.sqrt(
                Math.pow(line.p2.x - line.p1.x, 2) + 
                Math.pow(line.p2.y - line.p1.y, 2)
            );
            totalLength += length;
        });
        
        const avgLength = totalLength / count;
        
        // Calculate complexity based on line count and average length
        // More black lines and shorter average length = higher complexity
        const complexity = (count * 100) / (avgLength + 1);
        
        // Determine if this is a black-line CP suitable for edge/corner placement
        // Black-line CP: predominantly black lines (>70% black)
        const totalLines = cp.lines.length;
        const blackRatio = count / totalLines;
        const isBlackLineCP = blackRatio > 0.7;
        
        // Check if suitable for corner placement (compact, high black line density)
        const isCornerSuitable = isBlackLineCP && count >= 3 && avgLength < 100;
        
        // Check if suitable for edge placement (linear, moderate black line density)
        const isEdgeSuitable = isBlackLineCP && count >= 2 && avgLength >= 50 && avgLength < 200;
        
        return {
            count,
            totalLength,
            avgLength,
            complexity,
            isBlackLineCP,
            isCornerSuitable,
            isEdgeSuitable
        };
    }

    addIntersectionCreases(mergedLines, mergedPoints, pointMap, cpLinesBySource, autoFlatFold) {
        // Find intersections between lines from different sources, but only same-color lines
        for (let i = 0; i < cpLinesBySource.length; i++) {
            for (let j = i + 1; j < cpLinesBySource.length; j++) {
                const lines1 = cpLinesBySource[i];
                const lines2 = cpLinesBySource[j];
                
                lines1.forEach(line1 => {
                    lines2.forEach(line2 => {
                        // Only process intersections between same-colored lines
                        if (line1.color !== line2.color) {
                            return;
                        }
                        
                        const intersection = this.getLineIntersection(
                            line1.p1, line1.p2,
                            line2.p1, line2.p2
                        );
                        
                        if (intersection) {
                            // Add intersection point
                            const key = `${intersection.x.toFixed(2)},${intersection.y.toFixed(2)}`;
                            if (!pointMap.has(key)) {
                                pointMap.set(key, intersection);
                                mergedPoints.push(intersection);
                            }
                            
                            // Add crease lines from intersection to nearby points
                            this.addCreaseFromIntersection(mergedLines, mergedPoints, pointMap, intersection, line1, line2, autoFlatFold);
                        }
                    });
                });
            }
        }
    }

    getLineIntersection(p1, p2, p3, p4) {
        const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
        
        if (Math.abs(denom) < 0.0001) {
            return null; // Lines are parallel
        }
        
        const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
        const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;
        
        if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
            return {
                x: p1.x + ua * (p2.x - p1.x),
                y: p1.y + ua * (p2.y - p1.y)
            };
        }
        
        return null;
    }

    addCreaseFromIntersection(mergedLines, mergedPoints, pointMap, intersection, line1, line2, autoFlatFold) {
        // Find nearby points to connect with
        const nearbyPoints = mergedPoints.filter(p => {
            const dist = Math.sqrt((p.x - intersection.x) ** 2 + (p.y - intersection.y) ** 2);
            return dist > 1 && dist < 100; // Not too closes not too far
        }).slice(0, 4); // Limit to 4 nearest points
        
        nearbyPoints.forEach(point => {
            // Check if line already exists
            const lineExists = mergedLines.some(l => {
                const sameLine = 
                    (Math.abs(l.p1.x - intersection.x) < 0.1 && Math.abs(l.p1.y - intersection.y) < 0.1 &&
                     Math.abs(l.p2.x - point.x) < 0.1 && Math.abs(l.p2.y - point.y) < 0.1) ||
                    (Math.abs(l.p1.x - point.x) < 0.1 && Math.abs(l.p1.y - point.y) < 0.1 &&
                     Math.abs(l.p2.x - intersection.x) < 0.1 && Math.abs(l.p2.y - intersection.y) < 0.1);
                return sameLine;
            });
            
            if (!lineExists) {
                // Determine color based on auto flat fold setting
                let color = 'black';
                if (autoFlatFold) {
                    // Simple heuristic: alternate mountain/valley
                    color = Math.random() > 0.5 ? 'red' : 'blue';
                }
                
                mergedLines.push({
                    p1: {x: intersection.x, y: intersection.y},
                    p2: {x: point.x, y: point.y},
                    color: color
                });
            }
        });
    }
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    const cpStorage = new CPStorage();
    const treeCanvas = document.getElementById('tree_canvas');
    const mergedCanvas = document.getElementById('merged_canvas');
    const treeDiagram = new TreeDiagram(treeCanvas);
    const cpMerger = new CPMerger();
    
    // Update saved CPs list
    let selectedCPId = null;
    
    function updateSavedCPsList() {
        const list = document.getElementById('saved_cps_list');
        const cps = cpStorage.getAllCPs();
        list.innerHTML = '';
        
        cps.forEach(cp => {
            const item = document.createElement('div');
            item.className = 'cp-item';
            item.textContent = cp.name;
            item.dataset.cpId = cp.id;
            item.onclick = () => {
                document.querySelectorAll('.cp-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                selectedCPId = cp.id;
                if (treeDiagram.selectedNode) {
                    treeDiagram.assignCPToNode(cp.id);
                }
            };
            list.appendChild(item);
        });
    }
    
    // Save current CP
    document.getElementById('save_cp').addEventListener('click', () => {
        const name = document.getElementById('cp_name').value;
        if (name && points && lines) {
            cpStorage.saveCP(name, points, lines);
            document.getElementById('cp_name').value = '';
            updateSavedCPsList();
            alert('展開図を保存しました');
        } else {
            alert('展開図名を入力してください');
        }
    });
    
    // Import file (SVG or FOLD)
    document.getElementById('import_file').addEventListener('click', () => {
        const fileInput = document.getElementById('file_import');
        const file = fileInput.files[0];
        
        if (!file) {
            alert('ファイルを選択してください');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const fileContent = e.target.result;
                const fileExtension = file.name.split('.').pop().toLowerCase();
                let parsedData;
                
                if (fileExtension === 'svg') {
                    parsedData = cpStorage.parseSVG(fileContent);
                } else if (fileExtension === 'fold') {
                    parsedData = cpStorage.parseFOLD(fileContent);
                } else {
                    alert('対応していないファイル形式です');
                    return;
                }
                
                const name = document.getElementById('cp_name').value || file.name.replace(/\.[^/.]+$/, '');
                cpStorage.saveCP(name, parsedData.points, parsedData.lines);
                document.getElementById('cp_name').value = '';
                fileInput.value = '';
                updateSavedCPsList();
                alert('ファイルをインポートしました');
            } catch (error) {
                alert('ファイルの解析に失敗しました: ' + error.message);
            }
        };
        reader.readAsText(file);
    });
    
    // Delete selected CP
    document.getElementById('delete_selected_cp').addEventListener('click', () => {
        if (!selectedCPId) {
            alert('削除する展開図を選択してください');
            return;
        }
        
        if (confirm('選択した展開図を削除しますか？')) {
            cpStorage.deleteCP(selectedCPId);
            selectedCPId = null;
            updateSavedCPsList();
            alert('展開図を削除しました');
        }
    });
    
    // Load CP to editor (redirect to index.html)
    document.getElementById('load_to_editor').addEventListener('click', () => {
        window.location.href = 'index.html';
    });
    
    // Add node to tree
    document.getElementById('add_node').addEventListener('click', () => {
        treeDiagram.addNode();
    });
    
    // Remove node from tree
    document.getElementById('remove_node').addEventListener('click', () => {
        treeDiagram.removeNode();
    });
    
    // Merge all CPs in tree
    document.getElementById('merge_all').addEventListener('click', () => {
        const cpIds = treeDiagram.getAllCPIds();
        if (cpIds.length === 0) {
            alert('統合する展開図がありません。樹形図のノードに展開図を割り当ててください。');
            return;
        }
        
        const autoOptimize = document.getElementById('auto_optimize').checked;
        const usePatternMatching = document.getElementById('use_pattern_matching').checked;
        const eliminateIntersections = document.getElementById('eliminate_intersections').checked;
        const enableFlatFoldResize = document.getElementById('enable_flat_fold_resize').checked;
        const scale = parseFloat(document.getElementById('merge_scale').value);
        const autoFlatFold = document.getElementById('auto_flat_fold').checked;
        const optimize22_5 = document.getElementById('optimize_22_5').checked;
        
        try {
            const merged = cpMerger.mergeCPs(cpIds, scale, true, autoFlatFold, autoOptimize, treeDiagram, optimize22_5, usePatternMatching, eliminateIntersections, enableFlatFoldResize);
            if (merged) {
                drawMergedCP(merged);
            }
        } catch (error) {
            alert('統合エラー: ' + error.message);
        }
    });
    
    // Export merged CP
    document.getElementById('export_merged').addEventListener('click', () => {
        const cpIds = treeDiagram.getAllCPIds();
        if (cpIds.length === 0) {
            alert('エクスポートする展開図がありません');
            return;
        }
        
        const autoOptimize = document.getElementById('auto_optimize').checked;
        const usePatternMatching = document.getElementById('use_pattern_matching').checked;
        const eliminateIntersections = document.getElementById('eliminate_intersections').checked;
        const enableFlatFoldResize = document.getElementById('enable_flat_fold_resize').checked;
        const scale = parseFloat(document.getElementById('merge_scale').value);
        const autoFlatFold = document.getElementById('auto_flat_fold').checked;
        const optimize22_5 = document.getElementById('optimize_22_5').checked;
        
        try {
            const merged = cpMerger.mergeCPs(cpIds, scale, true, autoFlatFold, autoOptimize, treeDiagram, optimize22_5, usePatternMatching, eliminateIntersections, enableFlatFoldResize);
            if (merged) {
                const format = document.getElementById('export_format').value;
                
                if (format === 'json') {
                    const dataStr = JSON.stringify(merged, null, 2);
                    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
                    
                    const exportFileDefaultName = 'merged_crease_pattern.json';
                    const linkElement = document.createElement('a');
                    linkElement.setAttribute('href', dataUri);
                    linkElement.setAttribute('download', exportFileDefaultName);
                    linkElement.click();
                } else if (format === 'svg') {
                    const svgContent = convertToSVG(merged);
                    const dataUri = 'data:image/svg+xml;charset=utf-8,'+ encodeURIComponent(svgContent);
                    
                    const exportFileDefaultName = 'merged_crease_pattern.svg';
                    const linkElement = document.createElement('a');
                    linkElement.setAttribute('href', dataUri);
                    linkElement.setAttribute('download', exportFileDefaultName);
                    linkElement.click();
                }
            }
        } catch (error) {
            alert('エクスポートエラー: ' + error.message);
        }
    });
    
    // Convert merged CP to SVG format
    function convertToSVG(merged) {
        const width = 512;
        const height = 512;
        
        let svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 20010904//EN"
"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd">
<svg xmlns="http://www.w3.org/2000/svg"
 xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve"
 width="${width}px" height="${height}px"
 viewBox="0 0 ${width} ${height}" >
`;
        
        // Add lines as path elements
        merged.lines.forEach(line => {
            const strokeWidth = line.color === 'black' ? 4 : 2;
            svgContent += ` <path style="fill:none;stroke:${line.color};stroke-width:${strokeWidth}.000000px;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:1;fill-opacity:1.000000"
  d="M ${line.p1.x},${line.p1.y} L ${line.p2.x},${line.p2.y}" />
`;
        });
        
        svgContent += '</svg>';
        return svgContent;
    }
    
    // Draw merged CP on canvas
    function drawMergedCP(merged) {
        const ctx = mergedCanvas.getContext('2d');
        ctx.clearRect(0, 0, mergedCanvas.width, mergedCanvas.height);
        
        // Draw lines
        merged.lines.forEach(line => {
            ctx.beginPath();
            ctx.lineWidth = 1;
            ctx.strokeStyle = line.color;
            ctx.moveTo(line.p1.x, line.p1.y);
            ctx.lineTo(line.p2.x, line.p2.y);
            ctx.stroke();
        });
        
        // Draw points
        merged.points.forEach(point => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
            ctx.fillStyle = 'red';
            ctx.fill();
        });
    }
    
    // Scale slider value display
    document.getElementById('merge_scale').addEventListener('input', (e) => {
        document.getElementById('scale_value').textContent = parseFloat(e.target.value).toFixed(1);
    });
    
    // Initialize
    updateSavedCPsList();
    treeDiagram.draw();
});
