document.addEventListener('DOMContentLoaded', () => {
    const GRID_SIZE = 7;
    const gridContainer = document.getElementById('grid-container');
    const piecePalette = document.getElementById('piece-palette');
    const solveBtn = document.getElementById('solve-btn');
    const resetGridBtn = document.getElementById('reset-grid-btn');
    const fillAllBtn = document.getElementById('fill-all-btn');
    const clearPiecesBtn = document.getElementById('clear-pieces-btn');
    const solutionSummary = document.getElementById('solution-summary');
    const solutionsContainer = document.getElementById('solutions-container');

    let gridState = Array(GRID_SIZE * GRID_SIZE).fill(false);
    let lockedCells = new Set(); // Cells that cannot be toggled
    let piecesToUse = [];
    let isSolving = false;

    const MAX_SOLUTIONS = 10;
    const MAX_TIME_MS = 30000; // 30 seconds timeout
    const PRIORITIZE_HIGH_SCORE = true; // 높은 점수 조각부터 우선 배치 (false로 설정하면 정렬 없이 탐색)

    let isDragging = false;

    // Define locked area: center horizontal rectangle, 5 wide x 3 tall
    function initializeLockedArea() {
        const startRow = 2; // Center vertically: (7-3)/2 = 2
        const startCol = 1; // Center horizontally: (7-5)/2 = 1
        const rows = 3; // Height
        const cols = 5; // Width

        for (let r = startRow; r < startRow + rows && r < GRID_SIZE; r++) {
            for (let c = startCol; c < startCol + cols && c < GRID_SIZE; c++) {
                const index = r * GRID_SIZE + c;
                lockedCells.add(index);
                // Set locked cells as fillable by default
                gridState[index] = true;
            }
        }
    }

    initializeLockedArea();

    // --- 1. Grid Logic ---
    function createGrid() {
        gridContainer.innerHTML = '';

        // Add mouseup listener to the whole window to stop dragging
        window.addEventListener('mouseup', () => {
            isDragging = false;
        });

        for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
            const cell = document.createElement('div');
            cell.classList.add('grid-cell');
            cell.dataset.index = i;

            // Check if cell is locked
            if (lockedCells.has(i)) {
                cell.classList.add('locked');
                cell.classList.add('unlocked'); // Locked cells are also fillable
                cell.title = '잠긴 영역 (편집 불가, 조각 배치 가능)';
            } else {
                if (gridState[i]) cell.classList.add('unlocked');

                cell.addEventListener('mousedown', () => {
                    isDragging = true;
                    toggleCell(i);
                });

                cell.addEventListener('mouseover', () => {
                    if (isDragging) {
                        toggleCell(i);
                    }
                });
            }

            gridContainer.appendChild(cell);
        }
    }

    function toggleCell(index) {
        if (isSolving) return;
        if (lockedCells.has(index)) return; // Cannot toggle locked cells

        gridState[index] = !gridState[index];
        gridContainer.querySelector(`[data-index='${index}']`).classList.toggle('unlocked');
    }

    resetGridBtn.addEventListener('click', () => {
        if (isSolving) return;
        gridState.fill(false);
        // Re-initialize locked area as fillable
        lockedCells.forEach(index => {
            gridState[index] = true;
        });
        createGrid();
    });

    fillAllBtn.addEventListener('click', () => {
        if (isSolving) return;
        // Set all cells to unlocked (fillable)
        gridState.fill(true);
        createGrid();
        solutionSummary.textContent = '✅ 맵 전체가 열렸습니다!';
        solutionsContainer.innerHTML = '';
    });

    // --- 2. Piece Generation Logic ---

    // --- Piece Manipulation Helpers ---
    function normalizeShape(shape) {
        if (shape.length === 0) return [];
        const minR = Math.min(...shape.map(p => p[0]));
        const minC = Math.min(...shape.map(p => p[1]));
        return shape.map(([r, c]) => [r - minR, c - minC]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    }

    function rotateShape(shape) {
        const rotated = shape.map(([r, c]) => [c, -r]);
        return normalizeShape(rotated);
    }

    function flipShape(shape) {
        const flipped = shape.map(([r, c]) => [r, -c]);
        return normalizeShape(flipped);
    }

    function shapeToString(shape) {
        return JSON.stringify(shape);
    }

    function generateOrientations(baseShape) {
        const orientations = new Set();
        let currentShape = normalizeShape(baseShape);

        for (let i = 0; i < 4; i++) { // 4 rotations
            orientations.add(shapeToString(currentShape));
            orientations.add(shapeToString(flipShape(currentShape)));
            currentShape = rotateShape(currentShape);
        }
        return Array.from(orientations).map(s => JSON.parse(s));
    }

    // Score calculation by grade
    // 등급별 점수: 레어=칸당 30점, 에픽=칸당 60점, 슈퍼에픽=칸당 120점
    const GRADE_SCORES = {
        'rare': 30,      // 레어
        'epic': 60,      // 에픽
        'super': 120     // 슈퍼에픽
    };

    function calculateScore(cellCount, grade = 'rare') {
        return cellCount * GRADE_SCORES[grade];
    }

    // --- Base Piece Definitions ---
    const BASE_PIECES = {
        '1x1': { shape: [[0,0]], color: '#A9DFBF' },
        '1x2': { shape: [[0,0], [0,1]], color: '#A9DFBF' },
        '1x3': { shape: [[0,0], [0,1], [0,2]], color: '#A9DFBF' },
        '1x4': { shape: [[0,0], [0,1], [0,2], [0,3]], color: '#AED6F1' },
        '2x2': { shape: [[0,0], [0,1], [1,0], [1,1]], color: '#AED6F1' },
        '2x4': { shape: [[0,0], [0,1], [0,2], [0,3], [1,0], [1,1], [1,2], [1,3]], color: '#D7BDE2' },
        'L3': { shape: [[0,0], [1,0], [1,1]], color: '#A2D9CE' },
        'L4': { shape: [[0,0], [1,0], [2,0], [2,1]], color: '#AED6F1' },
        'T4': { shape: [[0,1], [1,0], [1,1], [1,2]], color: '#A9CCE3' },
        'Plus5': { shape: [[0,1], [1,0], [1,1], [1,2], [2,1]], color: '#D2B4DE' },
        'T5': { shape: [[0,0], [0,1], [0,2], [1,1], [2,1]], color: '#D2B4DE' },
        'P5_alt': { shape: [[0,1], [0,2], [1,1], [2,0], [2,1]], color: '#D2B4DE' },
        'L5': { shape: [[0,0], [0,1], [0,2], [1,2], [2,2]], color: '#D2B4DE' },
        'U5': { shape: [[0,0], [0,2], [1,0], [1,1], [1,2]], color: '#D2B4DE' },
        'Complex9_1': { shape: [[0,0], [1,0], [1,1], [2,0], [2,1], [3,0], [3,1], [4,1]], color: '#FFD700' },
        'Complex8_1': { shape: [[0,1], [0,2], [1,1], [1,2], [2,0], [2,1], [2,2], [2,3]], color: '#FF8C00' },
        'Complex8_2': { shape: [[0,1], [1,0], [1,1], [1,2], [2,0], [2,1], [2,2], [3,1]], color: '#FF4500' },
    };

    // --- Final PIECES object, generated from BASE_PIECES ---
    const PIECES = {};
    Object.entries(BASE_PIECES).forEach(([baseName, piece]) => {
        const orientations = generateOrientations(piece.shape);
        const cellCount = piece.shape.length;

        if (orientations.length === 1) {
            PIECES[baseName] = {
                shape: orientations[0],
                color: piece.color,
                cellCount: cellCount
            };
        } else {
            orientations.forEach((orientation, index) => {
                const pieceName = `${baseName}_${index + 1}`;
                PIECES[pieceName] = {
                    shape: orientation,
                    color: piece.color,
                    cellCount: cellCount
                };
            });
        }
    });

    function createPiecePalette() {
        piecePalette.innerHTML = '';

        // Group pieces by size
        const piecesBySize = {
            'small': [],    // 1-3 blocks
            'medium': [],   // 4 blocks
            'five': [],     // 5 blocks
            'unique': []    // 6+ blocks (unique shapes)
        };

        Object.entries(PIECES).forEach(([name, piece]) => {
            // Filter out specific pieces
            if (name === 'Complex8_1_2' || name === 'Complex8_1_3' || name === 'Complex9_1_4' || name === 'Complex9_1_2') {
                return;
            }

            const size = piece.shape.length;
            if (size <= 3) {
                piecesBySize.small.push([name, piece]);
            } else if (size === 4) {
                piecesBySize.medium.push([name, piece]);
            } else if (size === 5) {
                piecesBySize.five.push([name, piece]);
            } else {
                piecesBySize.unique.push([name, piece]);
            }
        });

        // Create sections for each size category
        const sections = [
            { key: 'small', title: '🟢 1~3칸', color: '#27AE60', bgColor: '#E8F8F5', borderColor: '#27AE60' },
            { key: 'medium', title: '🔵 4칸', color: '#2E86DE', bgColor: '#EBF5FB', borderColor: '#2E86DE' },
            { key: 'five', title: '🟣 5칸', color: '#8E44AD', bgColor: '#F4ECF7', borderColor: '#8E44AD' },
            { key: 'unique', title: '⭐ 5칸 이상 (UNIQUE)', color: '#E67E22', bgColor: '#FEF5E7', borderColor: '#E67E22' }
        ];

        sections.forEach(section => {
            const sectionEl = document.createElement('div');
            sectionEl.classList.add('piece-section');
            sectionEl.style.backgroundColor = section.bgColor;
            sectionEl.style.border = `3px solid ${section.borderColor}`;

            const sectionTitle = document.createElement('h4');
            sectionTitle.textContent = section.title;
            sectionTitle.style.color = section.color;
            sectionTitle.style.borderBottom = `3px solid ${section.color}`;
            sectionTitle.style.fontWeight = 'bold';
            sectionTitle.style.fontSize = '1.3em';
            sectionEl.appendChild(sectionTitle);

            const sectionGrid = document.createElement('div');
            sectionGrid.classList.add('piece-grid');

            piecesBySize[section.key].forEach(([name, piece]) => {
                const pieceEl = document.createElement('div');
                pieceEl.classList.add('piece-item');
                pieceEl.style.padding = '8px';

                // 조각 미리보기 컨테이너 (고정 크기)
                const previewContainer = document.createElement('div');
                previewContainer.classList.add('piece-preview');

                // 내부 그리드 (실제 조각 모양)
                const previewGrid = document.createElement('div');
                const shape = piece.shape;

                const maxRows = Math.max(...shape.map(p => p[0])) + 1;
                const maxCols = Math.max(...shape.map(p => p[1])) + 1;

                previewGrid.style.gridTemplateColumns = `repeat(${maxCols}, 20px)`;
                previewGrid.style.gridTemplateRows = `repeat(${maxRows}, 20px)`;

                for (let r = 0; r < maxRows; r++) {
                    for (let c = 0; c < maxCols; c++) {
                        const cell = document.createElement('div');
                        cell.classList.add('preview-cell');
                        if (shape.some(p => p[0] === r && p[1] === c)) {
                            cell.style.backgroundColor = piece.color;
                        }
                        previewGrid.appendChild(cell);
                    }
                }

                previewContainer.appendChild(previewGrid);

                // 등급별 개수 입력 컨테이너 (가로 배치)
                const gradesContainer = document.createElement('div');
                gradesContainer.style.display = 'flex';
                gradesContainer.style.gap = '10px';
                gradesContainer.style.flex = '1';
                gradesContainer.style.alignItems = 'center';

                // 레어 등급
                const rareCol = document.createElement('div');
                rareCol.style.display = 'flex';
                rareCol.style.flexDirection = 'column';
                rareCol.style.gap = '6px';
                rareCol.style.flex = '1';

                const rareLabel = document.createElement('div');
                rareLabel.textContent = `🟢 레어`;
                rareLabel.style.fontSize = '0.9em';
                rareLabel.style.fontWeight = '600';
                rareLabel.style.color = '#1e7e34';
                rareLabel.style.backgroundColor = '#d4edda';
                rareLabel.style.padding = '8px';
                rareLabel.style.borderRadius = '6px';
                rareLabel.style.textAlign = 'center';
                rareLabel.style.border = '2px solid #c3e6cb';

                const rareInput = document.createElement('input');
                rareInput.type = 'number';
                rareInput.value = '0';
                rareInput.min = '0';
                rareInput.max = '10';
                rareInput.id = `piece-count-${name}-rare`;
                rareInput.classList.add('piece-count-input');
                rareInput.style.width = '100%';
                rareInput.style.padding = '8px';
                rareInput.style.fontSize = '1em';
                rareInput.style.textAlign = 'center';
                rareInput.style.border = '2px solid #c3e6cb';
                rareInput.style.borderRadius = '6px';
                rareInput.style.fontWeight = 'bold';

                rareCol.appendChild(rareLabel);
                rareCol.appendChild(rareInput);

                // 에픽 등급
                const epicCol = document.createElement('div');
                epicCol.style.display = 'flex';
                epicCol.style.flexDirection = 'column';
                epicCol.style.gap = '6px';
                epicCol.style.flex = '1';

                const epicLabel = document.createElement('div');
                epicLabel.textContent = `🔵 에픽`;
                epicLabel.style.fontSize = '0.9em';
                epicLabel.style.fontWeight = '600';
                epicLabel.style.color = '#4527a0';
                epicLabel.style.backgroundColor = '#e1bee7';
                epicLabel.style.padding = '8px';
                epicLabel.style.borderRadius = '6px';
                epicLabel.style.textAlign = 'center';
                epicLabel.style.border = '2px solid #ce93d8';

                const epicInput = document.createElement('input');
                epicInput.type = 'number';
                epicInput.value = '0';
                epicInput.min = '0';
                epicInput.max = '10';
                epicInput.id = `piece-count-${name}-epic`;
                epicInput.classList.add('piece-count-input');
                epicInput.style.width = '100%';
                epicInput.style.padding = '8px';
                epicInput.style.fontSize = '1em';
                epicInput.style.textAlign = 'center';
                epicInput.style.border = '2px solid #ce93d8';
                epicInput.style.borderRadius = '6px';
                epicInput.style.fontWeight = 'bold';

                epicCol.appendChild(epicLabel);
                epicCol.appendChild(epicInput);

                // 슈퍼에픽 등급
                const superCol = document.createElement('div');
                superCol.style.display = 'flex';
                superCol.style.flexDirection = 'column';
                superCol.style.gap = '6px';
                superCol.style.flex = '1';

                const superLabel = document.createElement('div');
                superLabel.textContent = `⭐ 슈퍼`;
                superLabel.style.fontSize = '0.9em';
                superLabel.style.fontWeight = '600';
                superLabel.style.color = '#e65100';
                superLabel.style.backgroundColor = '#ffe0b2';
                superLabel.style.padding = '8px';
                superLabel.style.borderRadius = '6px';
                superLabel.style.textAlign = 'center';
                superLabel.style.border = '2px solid #ffcc80';

                const superInput = document.createElement('input');
                superInput.type = 'number';
                superInput.value = '0';
                superInput.min = '0';
                superInput.max = '10';
                superInput.id = `piece-count-${name}-super`;
                superInput.classList.add('piece-count-input');
                superInput.style.width = '100%';
                superInput.style.padding = '8px';
                superInput.style.fontSize = '1em';
                superInput.style.textAlign = 'center';
                superInput.style.border = '2px solid #ffcc80';
                superInput.style.borderRadius = '6px';
                superInput.style.fontWeight = 'bold';

                superCol.appendChild(superLabel);
                superCol.appendChild(superInput);

                gradesContainer.appendChild(rareCol);
                gradesContainer.appendChild(epicCol);
                gradesContainer.appendChild(superCol);

                pieceEl.append(previewContainer, gradesContainer);
                sectionGrid.appendChild(pieceEl);
            });

            sectionEl.appendChild(sectionGrid);
            piecePalette.appendChild(sectionEl);
        });
    }

    // --- 3. Clear Pieces ---
    function clearPieces() {
        Object.keys(PIECES).forEach(name => {
            const grades = ['rare', 'epic', 'super'];
            grades.forEach(grade => {
                const countInput = document.getElementById(`piece-count-${name}-${grade}`);
                if (countInput) {
                    countInput.value = '0';
                }
            });
        });
        solutionSummary.textContent = '';
        solutionsContainer.innerHTML = '';
    }

    clearPiecesBtn.addEventListener('click', clearPieces);

    // --- 4. Random Fill Pieces ---
    function randomFillPieces() {
        Object.keys(PIECES).forEach(name => {
            const grades = ['rare', 'epic', 'super'];
            grades.forEach(grade => {
                const countInput = document.getElementById(`piece-count-${name}-${grade}`);
                if (countInput) {
                    // 등급별 랜덤 범위: 레어 0~3, 에픽 0~2, 슈퍼에픽 0~1
                    let maxValue;
                    if (grade === 'rare') {
                        maxValue = 4; // 0~3
                    } else if (grade === 'epic') {
                        maxValue = 3; // 0~2
                    } else { // super
                        maxValue = 2; // 0~1
                    }
                    const randomValue = Math.floor(Math.random() * maxValue);
                    countInput.value = randomValue.toString();
                }
            });
        });
        solutionSummary.textContent = '🎲 랜덤 숫자가 입력되었습니다!';
        solutionsContainer.innerHTML = '';
    }

    const randomFillBtn = document.getElementById('random-fill-btn');
    randomFillBtn.addEventListener('click', randomFillPieces);

    function solve() {
        // Step 1: Check if map is created
        const targetCellCount = gridState.filter(Boolean).length;
        if (targetCellCount === 0) {
            solutionSummary.textContent = `❌ 맵을 먼저 만들어주세요!`;
            return;
        }

        // Step 2: Collect pieces from inputs
        piecesToUse = [];
        let piecesCellCount = 0;
        const pieceCounts = {};

        Object.entries(PIECES).forEach(([name, piece]) => {
            // 3개 등급별로 개수 입력 확인
            const grades = ['rare', 'epic', 'super'];

            grades.forEach(grade => {
                const countInput = document.getElementById(`piece-count-${name}-${grade}`);
                if (countInput) {
                    const count = parseInt(countInput.value, 10);
                    if (count > 0) {
                        const pieceScore = calculateScore(piece.cellCount, grade);
                        for (let i = 0; i < count; i++) {
                            // We need to create unique names for each piece instance
                            const uniqueName = `${name}_${grade}_${i}`;
                            piecesToUse.push({ name: uniqueName, ...piece, score: pieceScore, grade: grade });
                            piecesCellCount += piece.shape.length;
                        }
                    }
                }
            });
        });

        if (piecesToUse.length === 0) {
            solutionSummary.textContent = `❌ 조각을 먼저 입력해주세요!`;
            return;
        }

        // 높은 점수 조각부터 우선 배치하도록 정렬 (점수 내림차순)
        // PRIORITIZE_HIGH_SCORE가 false면 정렬 없이도 작동하지만, 탐색 효율성이 떨어질 수 있습니다
        if (PRIORITIZE_HIGH_SCORE) {
            piecesToUse.sort((a, b) => {
                // 먼저 점수로 정렬 (높은 점수 우선)
                if (b.score !== a.score) {
                    return b.score - a.score;
                }
                // 점수가 같으면 칸 수가 적은 것 우선 (같은 점수면 더 작은 조각을 먼저 사용)
                return a.shape.length - b.shape.length;
            });
        }

        // Step 3: Set up and run DLX solver
        dlxSolutions = [];
        dlxStartTime = Date.now();
        isSolving = true;
        solveBtn.disabled = true;
        resetGridBtn.disabled = true;
        clearPiecesBtn.disabled = true;
        solutionSummary.textContent = `🔄 계산 중... (맵 ${targetCellCount}칸, 조각 총 ${piecesCellCount}칸)`;
        solutionsContainer.innerHTML = '';

        const board = Array(GRID_SIZE * GRID_SIZE).fill(-1);
        gridState.forEach((unlocked, i) => {
            if (unlocked) {
                board[i] = 0;
            }
        });

        setTimeout(() => {
            try {
                bestScoreFound = -Infinity; // Reset for each new search
                bestSolution = []; // Reset for each new search
                bestCellsFilled = 0; // Reset for each new search
                allSolutions = []; // Reset for each new search
                const root = createDlxMatrix(board, piecesToUse);
                search(root);
            } catch (e) {
                console.error("DLX Solver Error:", e);
            }

            isSolving = false;
            solveBtn.disabled = false;
            resetGridBtn.disabled = false;
            clearPiecesBtn.disabled = false;

            // 해결책 정렬 (칸 수 우선, 그 다음 점수)
            allSolutions.sort((a, b) => {
                if (b.cellsFilled !== a.cellsFilled) {
                    return b.cellsFilled - a.cellsFilled;
                }
                return b.score - a.score;
            });

            if (allSolutions.length > 0) {
                solutionsContainer.innerHTML = '';
                
                // 최대 10개의 해결책 렌더링
                const solutionsToShow = allSolutions.slice(0, MAX_SOLUTIONS);
                solutionsToShow.forEach((sol, index) => {
                    const processedSolution = processDlxSolution(sol.solution, sol.score);
                    renderSolution(processedSolution.board, processedSolution.score, index + 1, processedSolution.usedPieces, processedSolution.pieceGrades);
                });

                const elapsed = ((Date.now() - dlxStartTime) / 1000).toFixed(1);
                const bestSol = allSolutions[0];
                const maxFilled = bestSol.cellsFilled;
                const totalCells = board.filter(id => id >= 0).length;
                const solutionCount = solutionsToShow.length;
                
                if (solutionCount === 1) {
                    solutionSummary.textContent = `✅ 최적의 배치 방법을 찾았습니다! (저항: ${bestSol.score}, ${maxFilled}/${totalCells}칸 채움, ${elapsed}초)`;
                } else {
                    solutionSummary.textContent = `✅ ${solutionCount}개의 해결책을 찾았습니다! (최고 저항: ${bestSol.score}, ${maxFilled}/${totalCells}칸 채움, ${elapsed}초)`;
                }

            } else if (bestSolution.length > 0) {
                // 해결책이 없지만 bestSolution은 있는 경우 (이론적으로는 발생하지 않아야 함)
                const processedSolution = processDlxSolution(bestSolution, bestScoreFound);
                solutionsContainer.innerHTML = '';
                renderSolution(processedSolution.board, processedSolution.score, 1, processedSolution.usedPieces, processedSolution.pieceGrades);
                
                const elapsed = ((Date.now() - dlxStartTime) / 1000).toFixed(1);
                const maxFilled = processedSolution.board.filter(id => id > 0).length;
                const totalCells = board.filter(id => id >= 0).length;
                solutionSummary.textContent = `✅ 최적의 배치 방법을 찾았습니다! (저항: ${bestScoreFound}, ${maxFilled}/${totalCells}칸 채움, ${elapsed}초)`;
            } else {
                const elapsed = ((Date.now() - dlxStartTime) / 1000).toFixed(1);
                solutionSummary.textContent = `❌ 배치 방법을 찾지 못했습니다. (${elapsed}초)`;
                solutionsContainer.innerHTML = '<p style="text-align: center; color: #e74c3c; padding: 20px;">해결책을 찾지 못했습니다. 다른 조각 조합이나 더 넓은 맵을 시도해보세요.</p>';
            }
        }, 100);
    }

    function processDlxSolution(solution, score) {
        const newBoard = Array(GRID_SIZE * GRID_SIZE).fill(-1);
        let targetCellCount = 0; // Count cells that were initially fillable
        gridState.forEach((unlocked, i) => {
            if (unlocked) {
                newBoard[i] = 0; // Initialize fillable cells as 0
                targetCellCount++;
            }
        });

        let pieceId = 1;
        const usedPiecesDetails = [];
        const pieceGrades = {}; // pieceId -> grade 매핑
        let sumOfPieceCells = 0;

        solution.forEach(node => {
            let pieceNode = node;
            // Find the node in the row that contains the piece info
            while (!pieceNode.pieceInfo && pieceNode.R !== node) {
                pieceNode = pieceNode.R;
            }
            if (pieceNode.pieceInfo) {
                const { piece, pos } = pieceNode.pieceInfo;
                const currentPieceId = pieceId++;
                placePiece(newBoard, piece.shape, pos[0], pos[1], currentPieceId);
                pieceGrades[currentPieceId] = piece.grade || 'rare'; // grade 정보 저장
                usedPiecesDetails.push({ name: piece.name, score: piece.score, shape: piece.shape, grade: piece.grade });
                sumOfPieceCells += piece.shape.length;
            }
        });

        const actualFilledCells = newBoard.filter(id => id > 0).length;

        console.log(`--- Best Solution Details ---`);
        console.log(`Total Score: ${score}`);
        console.log(`Target Fillable Cells: ${targetCellCount}`);
        console.log(`Sum of Cells from Used Pieces: ${sumOfPieceCells}`);
        console.log(`Actual Filled Cells on Board: ${actualFilledCells}`);
        console.log("Used Pieces:");
        usedPiecesDetails.forEach(p => console.log(`  - ${p.name} (Score: ${p.score}, Cells: ${p.shape.length})`));
        console.log("------------------------------------");

        return { board: newBoard, score: score, usedPieces: usedPiecesDetails, pieceGrades: pieceGrades };
    }

    function canPlace(board, shape, row, col) {
        for (const [dr, dc] of shape) {
            const r = row + dr;
            const c = col + dc;
            if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE || board[r * GRID_SIZE + c] !== 0) {
                return false;
            }
        }
        return true;
    }

    function placePiece(board, shape, row, col, id) {
        for (const [dr, dc] of shape) {
            board[(row + dr) * GRID_SIZE + (col + dc)] = id;
        }
    }

    // Generate distinct colors for each piece
    function generateDistinctColors(count) {
        const colors = [];
        const goldenRatio = 0.618033988749895;
        let hue = Math.random();

        for (let i = 0; i < count; i++) {
            hue += goldenRatio;
            hue %= 1;
            const saturation = 0.6 + Math.random() * 0.2;
            const lightness = 0.5 + Math.random() * 0.2;
            colors.push(`hsl(${Math.floor(hue * 360)}, ${Math.floor(saturation * 100)}%, ${Math.floor(lightness * 100)}%)`);
        }
        return colors;
    }

    function blendColors(baseColor, tintColor) {
        // Parse base color (HSL format)
        const hslMatch = baseColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
        if (!hslMatch) return baseColor;

        const h = parseInt(hslMatch[1]);
        const s = parseInt(hslMatch[2]);
        const l = parseInt(hslMatch[3]);

        // Parse tint color (RGBA format)
        const rgbaMatch = tintColor.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
        if (!rgbaMatch) return baseColor;

        const tintR = parseInt(rgbaMatch[1]);
        const tintG = parseInt(rgbaMatch[2]);
        const tintB = parseInt(rgbaMatch[3]);
        const tintA = parseFloat(rgbaMatch[4]);

        // Convert HSL to RGB
        const hslToRgb = (h, s, l) => {
            s /= 100;
            l /= 100;
            const k = n => (n + h / 30) % 12;
            const a = s * Math.min(l, 1 - l);
            const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
            return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
        };

        const [baseR, baseG, baseB] = hslToRgb(h, s, l);

        // Blend colors using alpha compositing
        const blendedR = Math.round(baseR * (1 - tintA) + tintR * tintA);
        const blendedG = Math.round(baseG * (1 - tintA) + tintG * tintA);
        const blendedB = Math.round(baseB * (1 - tintA) + tintB * tintA);

        return `rgb(${blendedR}, ${blendedG}, ${blendedB})`;
    }

    function renderSolution(board, totalScore = 0, solutionNumber = 1, usedPieces = [], pieceGrades = {}) {
        // Create wrapper for solution
        const solutionWrapper = document.createElement('div');
        solutionWrapper.classList.add('solution-wrapper');

        // Add solution header
        const solutionHeader = document.createElement('div');
        solutionHeader.classList.add('solution-header');

        // Count pieces used and cells filled
        const uniquePieceIds = new Set(board.filter(id => id > 0));
        const filledCells = board.filter(id => id > 0).length;
        const totalCells = board.filter(id => id >= 0).length;

        solutionHeader.innerHTML = `
            <span class="solution-number">해결책 #${solutionNumber}</span>
            <span class="solution-stats">블록 ${uniquePieceIds.size}개 사용 | ${filledCells}/${totalCells} 칸 채움 | 저항: ${totalScore}</span>
        `;
        solutionWrapper.appendChild(solutionHeader);

        const solutionGrid = document.createElement('div');
        solutionGrid.classList.add('solution-grid');

        // Generate colors for each piece
        const pieceColors = generateDistinctColors(piecesToUse.length);

        // Create 2D array to detect borders
        const grid2D = [];
        for (let r = 0; r < GRID_SIZE; r++) {
            grid2D[r] = [];
            for (let c = 0; c < GRID_SIZE; c++) {
                grid2D[r][c] = board[r * GRID_SIZE + c];
            }
        }

        for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
            const cell = document.createElement('div');
            cell.classList.add('solution-cell');
            const pieceId = board[i];
            const row = Math.floor(i / GRID_SIZE);
            const col = i % GRID_SIZE;

            if (pieceId > 0) {
                // Apply grade-based color
                const grade = pieceGrades[pieceId] || 'rare';
                let finalColor;

                if (grade === 'rare') {
                    // 초록색
                    finalColor = 'hsl(120, 60%, 60%)';
                } else if (grade === 'epic') {
                    // 보라색
                    finalColor = 'hsl(280, 60%, 60%)';
                } else if (grade === 'super') {
                    // 연한 빨강
                    finalColor = 'hsl(10, 70%, 65%)';
                }

                cell.style.backgroundColor = finalColor;
                cell.style.position = 'relative';

                // Add borders between different pieces
                const borderWidth = '3px';
                const borderColor = 'black';

                // Check top
                if (row === 0 || grid2D[row - 1][col] !== pieceId) {
                    cell.style.borderTop = `${borderWidth} solid ${borderColor}`;
                }
                // Check bottom
                if (row === GRID_SIZE - 1 || grid2D[row + 1][col] !== pieceId) {
                    cell.style.borderBottom = `${borderWidth} solid ${borderColor}`;
                }
                // Check left
                if (col === 0 || grid2D[row][col - 1] !== pieceId) {
                    cell.style.borderLeft = `${borderWidth} solid ${borderColor}`;
                }
                // Check right
                if (col === GRID_SIZE - 1 || grid2D[row][col + 1] !== pieceId) {
                    cell.style.borderRight = `${borderWidth} solid ${borderColor}`;
                }

                // Add overlay pattern for locked cells
                if (lockedCells.has(i)) {
                    const overlay = document.createElement('div');
                    overlay.style.position = 'absolute';
                    overlay.style.top = '0';
                    overlay.style.left = '0';
                    overlay.style.right = '0';
                    overlay.style.bottom = '0';
                    overlay.style.background = 'repeating-linear-gradient(45deg, rgba(255,255,255,0.1), rgba(255,255,255,0.1) 4px, rgba(0,0,0,0.05) 4px, rgba(0,0,0,0.05) 8px)';
                    overlay.style.pointerEvents = 'none';
                    cell.appendChild(overlay);
                }

                // Add piece number in the center of each piece
                const isCenter = isPieceCenter(grid2D, row, col, pieceId);
                if (isCenter) {
                    cell.textContent = pieceId;
                    cell.style.display = 'flex';
                    cell.style.alignItems = 'center';
                    cell.style.justifyContent = 'center';
                    cell.style.fontWeight = 'bold';
                    cell.style.fontSize = '0.8em';
                    cell.style.color = '#fff';
                    cell.style.textShadow = '1px 1px 2px rgba(0,0,0,0.5)';
                    cell.style.zIndex = '1';
                }
            } else if (pieceId === 0) {
                // Empty cell that should have been filled - 빨간색으로 뚜렷하게 표시
                if (lockedCells.has(i)) {
                    // Empty locked cell (should have been filled but wasn't)
                    cell.style.backgroundColor = '#ff6b6b';
                    cell.style.border = '3px solid #c92a2a';
                    cell.style.boxShadow = 'inset 0 0 10px rgba(201, 42, 42, 0.5)';
                    // 빈칸 표시 아이콘 추가
                    cell.textContent = '✕';
                    cell.style.display = 'flex';
                    cell.style.alignItems = 'center';
                    cell.style.justifyContent = 'center';
                    cell.style.fontSize = '1.2em';
                    cell.style.fontWeight = 'bold';
                    cell.style.color = '#ffffff';
                    cell.style.textShadow = '1px 1px 2px rgba(0,0,0,0.5)';
                } else {
                    // 일반 빈칸도 빨간색으로 표시
                    cell.style.backgroundColor = '#ff8787';
                    cell.style.border = '2px solid #e03131';
                    cell.style.boxShadow = 'inset 0 0 8px rgba(224, 49, 49, 0.4)';
                    // 빈칸 표시 아이콘 추가
                    cell.textContent = '✕';
                    cell.style.display = 'flex';
                    cell.style.alignItems = 'center';
                    cell.style.justifyContent = 'center';
                    cell.style.fontSize = '1.1em';
                    cell.style.fontWeight = 'bold';
                    cell.style.color = '#ffffff';
                    cell.style.textShadow = '1px 1px 2px rgba(0,0,0,0.5)';
                }
            }
            solutionGrid.appendChild(cell);
        }
        solutionWrapper.appendChild(solutionGrid);
        solutionsContainer.appendChild(solutionWrapper);
    }

    // Find approximate center of each piece for labeling
    function isPieceCenter(grid2D, row, col, pieceId) {
        const cells = [];
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (grid2D[r][c] === pieceId) {
                    cells.push([r, c]);
                }
            }
        }

        if (cells.length === 0) return false;

        // Calculate centroid
        const avgRow = cells.reduce((sum, [r]) => sum + r, 0) / cells.length;
        const avgCol = cells.reduce((sum, [, c]) => sum + c, 0) / cells.length;

        // Find closest cell to centroid
        let minDist = Infinity;
        let centerCell = cells[0];
        for (const [r, c] of cells) {
            const dist = Math.sqrt((r - avgRow) ** 2 + (c - avgCol) ** 2);
            if (dist < minDist) {
                minDist = dist;
                centerCell = [r, c];
            }
        }

        return row === centerCell[0] && col === centerCell[1];
    }
    

    // --- 5. Solver Logic (DLX - Dancing Links) ---
    let dlxSolutions = [];
    let dlxStartTime = 0;

    function createDlxMatrix(board, pieces) {
        const fillableCells = [];
        board.forEach((val, i) => {
            if (val === 0) fillableCells.push(i);
        });

        // Primary columns: one for each fillable cell (must be covered)
        const primaryColDefinitions = fillableCells.map(cellIdx => ({ name: `cell_${cellIdx}`, type: 'primary' }));

        // Secondary columns: one for each piece instance (can be covered at most once, optional)
        const secondaryColDefinitions = pieces.map(piece => ({ name: `piece_${piece.name}`, type: 'secondary' }));

        const allColDefinitions = [...primaryColDefinitions, ...secondaryColDefinitions];
        const colMap = new Map(); // To quickly find column objects by name

        const root = { R: null, L: null, name: 'root' };
        root.R = root;
        root.L = root;

        let currentHeader = root;
        allColDefinitions.forEach(h => {
            const newCol = { U: null, D: null, L: currentHeader, R: root, size: 0, name: h.name, type: h.type };
            newCol.U = newCol;
            newCol.D = newCol;
            currentHeader.R = newCol;
            currentHeader = newCol;
            colMap.set(h.name, newCol);
        });
        root.L = currentHeader; // Close the circular list of columns


        // Rows: one for each valid placement of a piece
        for (let i = 0; i < pieces.length; i++) {
            const piece = pieces[i];
            const pieceSecondaryCol = colMap.get(`piece_${piece.name}`); // Get the secondary column for this piece instance

            for (let r = 0; r < GRID_SIZE; r++) {
                for (let c = 0; c < GRID_SIZE; c++) {
                    if (canPlace(board, piece.shape, r, c)) {
                        const coveredCells = piece.shape.map(([dr, dc]) => (r + dr) * GRID_SIZE + (c + dc));
                        const cellColNames = coveredCells.map(cellPos => `cell_${cellPos}`);

                        // Ensure all covered cells are actually fillable (primary columns exist for them)
                        // This check is technically redundant if canPlace is correct, but good for robustness
                        if (cellColNames.some(name => !colMap.has(name) || colMap.get(name).type !== 'primary')) {
                            continue;
                        }

                        // Create a new row
                        const rowNodes = [];
                        // Node for the piece's secondary column
                        rowNodes.push({ col: pieceSecondaryCol, pieceInfo: { piece, pos: [r, c] } });
                        // Nodes for the cell primary columns
                        cellColNames.forEach(colName => {
                            rowNodes.push({ col: colMap.get(colName) });
                        });

                        // Link nodes together
                        if (rowNodes.length > 0) {
                            let firstNode = null, prevNode = null;
                            rowNodes.forEach(nodeData => {
                                const newNode = {
                                    U: nodeData.col.U,
                                    D: nodeData.col,
                                    L: null,
                                    R: null,
                                    C: nodeData.col,
                                    pieceInfo: nodeData.pieceInfo || null
                                };
                                nodeData.col.U.D = newNode;
                                nodeData.col.U = newNode;
                                nodeData.col.size++;

                                if (!firstNode) firstNode = newNode;
                                if (prevNode) {
                                    newNode.L = prevNode;
                                    prevNode.R = newNode;
                                }
                                prevNode = newNode;
                            });
                            firstNode.L = prevNode;
                            prevNode.R = firstNode;
                        }
                    }
                }
            }
        }
        return root;
    }

    function cover(c) {
        c.R.L = c.L;
        c.L.R = c.R;
        for (let i = c.D; i !== c; i = i.D) {
            for (let j = i.R; j !== i; j = j.R) {
                j.D.U = j.U;
                j.U.D = j.D;
                j.C.size--;
            }
        }
    }

    function uncover(c) {
        for (let i = c.U; i !== c; i = i.U) {
            for (let j = i.L; j !== i; j = j.L) {
                j.C.size++;
                j.D.U = j;
                j.U.D = j;
            }
        }
        c.R.L = c;
        c.L.R = c;
    }

    let bestScoreFound = -Infinity;
    let bestSolution = [];
    let bestCellsFilled = 0;
    let allSolutions = []; // 여러 해결책 저장

    function search(root, partialSolution = [], currentScore = 0) {
        if (Date.now() - dlxStartTime > MAX_TIME_MS) {
            return;
        }

        // Count how many primary columns are still uncovered
        let uncoveredPrimaryCount = 0;
        let current = root.R;
        while (current !== root) {
            if (current.type === 'primary') {
                uncoveredPrimaryCount++;
            }
            current = current.R;
        }

        // Calculate how many cells are currently filled in this partial solution
        const filledCellsSet = new Set();
        partialSolution.forEach(node => {
            let pieceNode = node;
            while (!pieceNode.pieceInfo && pieceNode.R !== node) {
                pieceNode = pieceNode.R;
            }
            if (pieceNode.pieceInfo) {
                const { piece, pos } = pieceNode.pieceInfo;
                piece.shape.forEach(([dr, dc]) => {
                    const r = pos[0] + dr;
                    const c = pos[1] + dc;
                    filledCellsSet.add(r * GRID_SIZE + c);
                });
            }
        });
        const currentCellsFilled = filledCellsSet.size;

        // Update best solution if this is better (prioritize more cells filled, then higher score)
        const isBetter = currentCellsFilled > bestCellsFilled || 
                        (currentCellsFilled === bestCellsFilled && currentScore > bestScoreFound);
        
        if (isBetter) {
            bestScoreFound = currentScore;
            bestSolution = [...partialSolution];
            bestCellsFilled = currentCellsFilled;
        }

        // 해결책 저장 (최대 10개까지)
        // 최고 채운 칸 수와 같은 해결책이거나, 최고 점수와 비슷한 해결책 저장
        if (partialSolution.length > 0) {
            const isTopSolution = currentCellsFilled === bestCellsFilled;
            const isHighScore = bestScoreFound > 0 && currentScore >= bestScoreFound * 0.95;
            
            // 최고 칸 수를 채운 해결책이거나, 높은 점수 해결책 저장
            if (isTopSolution || (isHighScore && allSolutions.length < MAX_SOLUTIONS)) {
                // 중복 체크: 같은 점수와 같은 칸 수를 채운 해결책은 제외
                const isDuplicate = allSolutions.some(sol => {
                    if (sol.cellsFilled !== currentCellsFilled || sol.score !== currentScore) {
                        return false;
                    }
                    // 해결책의 조각 구성이 같은지 확인
                    const solPieces = sol.solution.map(node => {
                        let pieceNode = node;
                        while (!pieceNode.pieceInfo && pieceNode.R !== node) {
                            pieceNode = pieceNode.R;
                        }
                        return pieceNode.pieceInfo ? pieceNode.pieceInfo.piece.name : null;
                    }).sort().join(',');
                    
                    const currentPieces = partialSolution.map(node => {
                        let pieceNode = node;
                        while (!pieceNode.pieceInfo && pieceNode.R !== node) {
                            pieceNode = pieceNode.R;
                        }
                        return pieceNode.pieceInfo ? pieceNode.pieceInfo.piece.name : null;
                    }).sort().join(',');
                    
                    return solPieces === currentPieces;
                });
                
                if (!isDuplicate) {
                    allSolutions.push({
                        solution: [...partialSolution],
                        score: currentScore,
                        cellsFilled: currentCellsFilled
                    });
                    
                    // 점수와 칸 수 기준으로 정렬하고 최대 10개만 유지
                    allSolutions.sort((a, b) => {
                        if (b.cellsFilled !== a.cellsFilled) {
                            return b.cellsFilled - a.cellsFilled; // 더 많은 칸 우선
                        }
                        return b.score - a.score; // 같은 칸 수면 높은 점수 우선
                    });
                    
                    // 최대 10개만 유지
                    if (allSolutions.length > MAX_SOLUTIONS) {
                        allSolutions = allSolutions.slice(0, MAX_SOLUTIONS);
                    }
                }
            }
        }

        // If all primary columns are covered, a complete solution is found
        if (uncoveredPrimaryCount === 0) {
            // 완전한 해결책도 저장
            if (partialSolution.length > 0) {
                const isDuplicate = allSolutions.some(sol => {
                    if (sol.cellsFilled !== currentCellsFilled || sol.score !== currentScore) {
                        return false;
                    }
                    const solPieces = sol.solution.map(node => {
                        let pieceNode = node;
                        while (!pieceNode.pieceInfo && pieceNode.R !== node) {
                            pieceNode = pieceNode.R;
                        }
                        return pieceNode.pieceInfo ? pieceNode.pieceInfo.piece.name : null;
                    }).sort().join(',');
                    
                    const currentPieces = partialSolution.map(node => {
                        let pieceNode = node;
                        while (!pieceNode.pieceInfo && pieceNode.R !== node) {
                            pieceNode = pieceNode.R;
                        }
                        return pieceNode.pieceInfo ? pieceNode.pieceInfo.piece.name : null;
                    }).sort().join(',');
                    
                    return solPieces === currentPieces;
                });
                
                if (!isDuplicate) {
                    allSolutions.push({
                        solution: [...partialSolution],
                        score: currentScore,
                        cellsFilled: currentCellsFilled
                    });
                    
                    allSolutions.sort((a, b) => {
                        if (b.cellsFilled !== a.cellsFilled) {
                            return b.cellsFilled - a.cellsFilled;
                        }
                        return b.score - a.score;
                    });
                    
                    if (allSolutions.length > MAX_SOLUTIONS) {
                        allSolutions = allSolutions.slice(0, MAX_SOLUTIONS);
                    }
                }
            }
            return;
        }

        // Choose column c (heuristic: smallest size) - only consider primary columns
        let c = root.R;
        while (c !== root && c.type === 'secondary') { // Skip secondary columns for selection
            c = c.R;
        }
        if (c === root) { // No primary columns left (shouldn't happen if uncoveredPrimaryCount > 0)
            return;
        }

        // Find the primary column with the smallest size
        let minSize = c.size;
        let chosenCol = c;
        for (let j = c.R; j !== root; j = j.R) {
            if (j.type === 'primary' && j.size < minSize) {
                minSize = j.size;
                chosenCol = j;
            }
        }
        c = chosenCol;

        // If this column has no rows (size 0), we can't cover it - skip to next
        if (c.size === 0) {
            return;
        }

        // Collect all rows that cover column c and sort them by piece score (descending)
        // 높은 점수 조각부터 우선 배치하도록 정렬
        // 주석 처리하면 정렬 없이도 작동하지만, 탐색 효율성이 떨어질 수 있습니다
        const rowsToExplore = [];
        for (let r = c.D; r !== c; r = r.D) {
            let pieceNode = r;
            // Find the node in the row that contains the piece info
            while (!pieceNode.pieceInfo && pieceNode.R !== r) {
                pieceNode = pieceNode.R;
            }
            if (pieceNode.pieceInfo) {
                const piece = pieceNode.pieceInfo.piece;
                const pieceScore = piece.score;
                // 조각의 원래 인덱스 찾기 (높은 점수 조각이 먼저 나오도록)
                const pieceIndex = piecesToUse.findIndex(p => p.name === piece.name);
                rowsToExplore.push({ 
                    rowNode: r, 
                    score: pieceScore,
                    pieceIndex: pieceIndex >= 0 ? pieceIndex : Infinity
                });
            }
        }

        // 높은 점수 우선, 점수가 같으면 먼저 나온 조각 우선
        // PRIORITIZE_HIGH_SCORE가 false면 모든 조각을 동등하게 탐색합니다
        if (PRIORITIZE_HIGH_SCORE) {
            rowsToExplore.sort((a, b) => {
                if (b.score !== a.score) {
                    return b.score - a.score; // 높은 점수 우선
                }
                return a.pieceIndex - b.pieceIndex; // 같은 점수면 먼저 나온 조각 우선
            });
        }

        cover(c);

        for (const { rowNode: r, score: pieceScore } of rowsToExplore) {
            // Calculate how many new cells this piece would fill
            let pieceNode = r;
            while (!pieceNode.pieceInfo && pieceNode.R !== r) {
                pieceNode = pieceNode.R;
            }
            
            if (pieceNode.pieceInfo) {
                const { piece, pos } = pieceNode.pieceInfo;
                const newCells = piece.shape.map(([dr, dc]) => {
                    const r = pos[0] + dr;
                    const c = pos[1] + dc;
                    return r * GRID_SIZE + c;
                });
                
                // Count how many of these cells are not already filled
                const actuallyNewCells = newCells.filter(cell => !filledCellsSet.has(cell));
                
                // 이 조각이 실제로 새로운 칸을 채울 수 있는지 확인
                if (actuallyNewCells.length > 0) {
                    const potentialCellsFilled = currentCellsFilled + actuallyNewCells.length;
                    const potentialScore = currentScore + pieceScore;
                    
                    // Pruning 완화: 더 많은 가능성을 탐색하도록 수정
                    // 현재 해결책보다 좋거나, 아직 해결책이 없거나, 또는 최고 해결책의 80% 이상이면 탐색
                    const shouldExplore = 
                        bestCellsFilled === 0 || // 아직 해결책이 없으면 무조건 탐색
                        potentialCellsFilled > bestCellsFilled || // 더 많은 칸을 채울 수 있으면
                        (potentialCellsFilled === bestCellsFilled && potentialScore >= bestScoreFound) || // 같은 칸 수면 점수 비교
                        (bestCellsFilled > 0 && potentialCellsFilled >= bestCellsFilled * 0.8); // 최고의 80% 이상이면 탐색
                    
                    if (shouldExplore) {
                        // Cover all columns that this row covers (standard DLX)
                        for (let j = r.R; j !== r; j = j.R) {
                            cover(j.C);
                        }
                        
                        partialSolution.push(r);
                        search(root, partialSolution, potentialScore);
                        partialSolution.pop();
                        
                        // Uncover all columns that this row covers (standard DLX)
                        for (let j = r.L; j !== r; j = j.L) {
                            uncover(j.C);
                        }
                    }
                }
            }
        }

        uncover(c);
    }

    solveBtn.addEventListener('click', solve);

    // --- Initial Calls ---
    createGrid();
    createPiecePalette();
});
