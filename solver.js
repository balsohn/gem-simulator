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

    // --- Image Upload & OCR ---
    const uploadBtn = document.getElementById('upload-btn');
    const imageUpload = document.getElementById('image-upload');
    const uploadStatus = document.getElementById('upload-status');
    const previewContainer = document.getElementById('preview-container');
    const previewImage = document.getElementById('preview-image');

    // Disable upload button until OpenCV is ready
    uploadBtn.style.pointerEvents = 'none';
    uploadBtn.style.cursor = 'not-allowed';
    uploadBtn.style.opacity = '0.5';
    uploadStatus.textContent = '⏳ 이미지 분석기 로딩 중...';

    function onCvReady() {
        console.log('OpenCV is ready.');
        uploadStatus.textContent = '✅ 이미지 분석기 준비 완료';
        uploadStatus.style.color = '#10b981';
        uploadBtn.style.pointerEvents = 'auto';
        uploadBtn.style.cursor = 'pointer';
        uploadBtn.style.opacity = '1';
        console.log('Image analyzer is ready!');
    }

    // Wait for OpenCV to load and initialize
    function checkOpenCV() {
        if (typeof cv !== 'undefined') {
            // Check if OpenCV is already ready
            if (cv.Mat) {
                console.log('OpenCV already loaded');
                onCvReady();
            } else {
                // Set callback for when it's ready
                cv.onRuntimeInitialized = () => {
                    console.log('OpenCV initialized via callback');
                    onCvReady();
                };
            }
        } else {
            // If cv is not defined yet, check again after 100ms
            setTimeout(checkOpenCV, 100);
        }
    }

    checkOpenCV();

    // 사용법 모달
    const usageModal = document.getElementById('usage-modal');
    const usageBtn = document.getElementById('usage-btn');
    const closeModal = document.getElementById('close-modal');

    usageBtn?.addEventListener('click', () => {
        usageModal.style.display = 'block';
    });

    closeModal?.addEventListener('click', () => {
        usageModal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === usageModal) {
            usageModal.style.display = 'none';
        }
    });

    // 조각 이미지 인식 (그리드 분석 방식)
    imageUpload?.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (files.length === 0) return;

        uploadStatus.textContent = `🔄 ${files.length}장의 이미지 분석 중...`;
        uploadStatus.style.color = '#667eea';

        try {
            // 모든 이미지에서 인식된 조각 합산
            const allResults = {};

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                console.log(`Processing image ${i + 1}/${files.length}: ${file.name}`);

                const pieceData = await recognizePiecesWithCV(file);

                // 결과 합산
                for (const result of pieceData) {
                    const key = `${result.pieceName}-${result.grade}`;
                    allResults[key] = (allResults[key] || 0) + result.count;
                }
            }

            // 합산 결과를 배열로 변환
            const finalResults = Object.entries(allResults).map(([key, count]) => {
                const [pieceName, grade] = key.split('-');
                return { pieceName, grade, count };
            });

            if (finalResults.length === 0) {
                uploadStatus.textContent = '⚠️ 조각 정보를 찾을 수 없습니다. 이미지가 선명한지 확인해주세요.';
                uploadStatus.style.color = '#f59e0b';
                return;
            }

            fillPiecesFromCV(finalResults);

            const totalPieces = finalResults.reduce((sum, p) => sum + p.count, 0);
            uploadStatus.textContent = `✅ ${files.length}장 분석 완료! ${finalResults.length}개 종류, 총 ${totalPieces}개의 조각을 인식했습니다!`;
            uploadStatus.style.color = '#10b981';

        } catch (error) {
            console.error('Image Analysis Error:', error);
            uploadStatus.textContent = `❌ 이미지 분석 실패: ${error.message || '알 수 없는 오류'}.`;
            uploadStatus.style.color = '#f5576c';
        }

        // 파일 선택 초기화 (같은 파일 다시 선택 가능)
        e.target.value = '';
    });



    // 이미지에서 직접 조각 영역 찾기 (격자 형태로 배열된 조각들)
    function findPieceRegionsFromImage(canvas, ctx, imageWidth, imageHeight) {
        const pieces = [];
        
        // 조각 영역은 보통 오른쪽 패널에 있고, 격자 형태로 배열됨
        // 이미지의 오른쪽 40-90% 영역에서 조각 영역 찾기
        const searchX = Math.floor(imageWidth * 0.4);
        const searchWidth = Math.floor(imageWidth * 0.5);
        
        // 배경색 변화를 감지하여 조각 타일 경계 찾기
        // Y 좌표를 세밀하게 스캔하여 배경색 변화 지점 찾기
        const scanStep = 5; // 5픽셀씩 스캔
        const minTileHeight = 30; // 최소 타일 높이
        const maxTileHeight = 100; // 최대 타일 높이
        
        let currentY = Math.floor(imageHeight * 0.1);
        let lastGrade = null;
        let tileStartY = null;
        
        while (currentY < imageHeight * 0.9) {
            // 현재 위치의 배경색 확인
            const testImageData = ctx.getImageData(searchX, currentY, searchWidth, scanStep);
            const testGrade = detectGradeFromBackground(testImageData);
            
            // 배경색이 변경되면 조각 타일 경계
            if (lastGrade !== null && testGrade !== lastGrade) {
                // 이전 타일 종료
                if (tileStartY !== null && currentY - tileStartY >= minTileHeight) {
                    const tileHeight = currentY - tileStartY;
                    if (tileHeight <= maxTileHeight) {
                        pieces.push({
                            count: 1, // 기본값 (나중에 OCR로 업데이트)
                            total: 1,
                            bbox: { x0: searchX, y0: tileStartY, x1: searchX + searchWidth, y1: currentY },
                            y: tileStartY + tileHeight / 2, // 타일 중앙
                            x: searchX
                        });
                    }
                }
                // 새 타일 시작
                tileStartY = currentY;
                lastGrade = testGrade;
            } else if (lastGrade === null) {
                // 첫 타일 시작
                tileStartY = currentY;
                lastGrade = testGrade;
            }
            
            currentY += scanStep;
        }
        
        // 마지막 타일 처리
        if (tileStartY !== null && currentY - tileStartY >= minTileHeight) {
            const tileHeight = currentY - tileStartY;
            if (tileHeight <= maxTileHeight) {
                pieces.push({
                    count: 1,
                    total: 1,
                    bbox: { x0: searchX, y0: tileStartY, x1: searchX + searchWidth, y1: currentY },
                    y: tileStartY + tileHeight / 2,
                    x: searchX
                });
            }
        }
        
        // 배경색 변화 감지가 실패한 경우, 고정된 격자 패턴 사용
        // 이미지 설명에 따르면: 3행 5열 + 마지막 행 2개 = 총 17개
        if (pieces.length < 10) {
            console.log('배경색 변화 감지 실패, 고정된 격자 패턴 사용...');
            pieces.length = 0; // 기존 결과 초기화
            
            const startY = Math.floor(imageHeight * 0.15);
            const endY = Math.floor(imageHeight * 0.85);
            const availableHeight = endY - startY;
            
            // 4행으로 나눔 (첫 3행은 5개씩, 마지막 행은 2개)
            const rowHeight = availableHeight / 4;
            let currentY = startY;
            
            // 첫 3행: 각각 5개 조각
            for (let row = 0; row < 3; row++) {
                const tileHeight = rowHeight / 5;
                for (let col = 0; col < 5; col++) {
                    const tileY = currentY + col * tileHeight;
                    pieces.push({
                        count: 1,
                        total: 1,
                        bbox: { x0: searchX, y0: tileY, x1: searchX + searchWidth, y1: tileY + tileHeight },
                        y: tileY + tileHeight / 2,
                        x: searchX
                    });
                }
                currentY += rowHeight;
            }
            
            // 마지막 행: 2개 조각
            const tileHeight = rowHeight / 2;
            for (let col = 0; col < 2; col++) {
                const tileY = currentY + col * tileHeight;
                pieces.push({
                    count: 1,
                    total: 1,
                    bbox: { x0: searchX, y0: tileY, x1: searchX + searchWidth, y1: tileY + tileHeight },
                    y: tileY + tileHeight / 2,
                    x: searchX
                });
            }
        }
        
        // Y 좌표 기준으로 정렬
        pieces.sort((a, b) => a.y - b.y);
        
        console.log(`이미지에서 ${pieces.length}개의 조각 타일 영역을 찾았습니다.`);
        
        return pieces;
    }

    // 조각 아이콘의 크기만 측정 (1x1 기준 찾기용)
    function measurePieceIconSize(canvas, ctx, x, y, width, height) {
        const iconSize = Math.min(100, Math.min(width, height) * 0.6);
        const centerX = Math.floor(width * 0.5);
        const centerY = Math.floor(height * 0.5);
        const iconX = Math.max(0, centerX - iconSize / 2);
        const iconY = Math.max(0, centerY - iconSize / 2);
        
        try {
            const iconImageData = ctx.getImageData(x + iconX, y + iconY, iconSize, iconSize);
            const sizeInfo = detectPieceShapeInSection(iconImageData, true, true); // 크기만 측정
            return sizeInfo;
        } catch (e) {
            try {
                const iconImageData = ctx.getImageData(x, y, width, height);
                const sizeInfo = detectPieceShapeInSection(iconImageData, false, true); // 크기만 측정
                return sizeInfo;
            } catch (e2) {
                return null;
            }
        }
    }

    function analyzePieceSection(canvas, ctx, x, y, width, height, baseUnitSize = null) {
        // Extract pixel data from section
        const imageData = ctx.getImageData(x, y, width, height);

        // Determine grade from background color
        const grade = detectGradeFromBackground(imageData);

        // 조각 아이콘 찾기: 중앙 영역만 스캔 (성능 최적화)
        const iconSize = Math.min(100, Math.min(width, height) * 0.6);
        const centerX = Math.floor(width * 0.5);
        const centerY = Math.floor(height * 0.5);
        const iconX = Math.max(0, centerX - iconSize / 2);
        const iconY = Math.max(0, centerY - iconSize / 2);
        
        let bestIcon = null;
        
        try {
            const iconImageData = ctx.getImageData(x + iconX, y + iconY, iconSize, iconSize);
            const iconInfo = detectPieceShapeInSection(iconImageData, true, false, baseUnitSize);
            bestIcon = iconInfo ? iconInfo.pieceName : null;
        } catch (e) {
            // 영역이 범위를 벗어난 경우 무시
        }
        
        // 조각 아이콘을 찾지 못한 경우, 전체 영역에서 다시 시도
        if (!bestIcon) {
            try {
                const iconImageData = ctx.getImageData(x, y, width, height);
                const iconInfo = detectPieceShapeInSection(iconImageData, false, false, baseUnitSize);
                bestIcon = iconInfo ? iconInfo.pieceName : null;
            } catch (e) {
                // 무시
            }
        }

        console.log(`Section analysis: grade=${grade}, piece=${bestIcon}`);

        return { pieceName: bestIcon, grade };
    }

    function detectGradeFromBackground(imageData) {
        const { data, width, height } = imageData;

        // 더 많은 샘플 포인트로 배경색 추출 (배경은 보통 왼쪽이나 중앙에 있음)
        const colorSamples = [];
        const samplePoints = 20;

        // 여러 위치에서 샘플링 (왼쪽, 중앙, 오른쪽)
        for (let i = 0; i < samplePoints; i++) {
            // 왼쪽 영역 (배경이 있을 가능성이 높음)
            const x = Math.floor((width * 0.3 / samplePoints) * i);
            const y = Math.floor(height / 2);
            const idx = (y * width + x) * 4;

            if (idx < data.length - 3) {
            colorSamples.push({
                r: data[idx],
                g: data[idx + 1],
                b: data[idx + 2]
            });
            }
        }

        // 중앙 영역도 샘플링
        for (let i = 0; i < 5; i++) {
            const x = Math.floor(width * 0.3 + (width * 0.2 / 5) * i);
            const y = Math.floor(height / 2);
            const idx = (y * width + x) * 4;

            if (idx < data.length - 3) {
                colorSamples.push({
                    r: data[idx],
                    g: data[idx + 1],
                    b: data[idx + 2]
                });
            }
        }

        if (colorSamples.length === 0) {
            console.log('No color samples found, using default rare');
            return 'rare';
        }

        // Average color
        const avgColor = {
            r: colorSamples.reduce((sum, c) => sum + c.r, 0) / colorSamples.length,
            g: colorSamples.reduce((sum, c) => sum + c.g, 0) / colorSamples.length,
            b: colorSamples.reduce((sum, c) => sum + c.b, 0) / colorSamples.length
        };

        console.log('Background color:', avgColor);

        return estimateGradeFromColor(avgColor);
    }

    function detectPieceShapeInSection(imageData, isSmallRegion = false, sizeOnly = false, baseUnitSize = null) {
        // Find the piece icon (smaller colored region within section)
        const { data, width, height } = imageData;

        // 배경색 추정 (가장 많은 색상, 가장자리 색상도 고려)
        const colorMap = new Map();
        const edgeSamples = []; // 가장자리 샘플 (배경일 가능성이 높음)
        
        // 가장자리 샘플링
        for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 5))) {
            for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 5))) {
                if (x === 0 || x >= width - 1 || y === 0 || y >= height - 1) {
                    const i = (y * width + x) * 4;
                    edgeSamples.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
                }
            }
        }
        
        // 전체 영역 샘플링 (10단위로 양자화)
        for (let y = 0; y < height; y += 5) {
            for (let x = 0; x < width; x += 5) {
                const i = (y * width + x) * 4;
                const r = Math.floor(data[i] / 15) * 15; // 15단위로 양자화 (더 넓은 범위)
                const g = Math.floor(data[i + 1] / 15) * 15;
                const b = Math.floor(data[i + 2] / 15) * 15;
                const key = `${r},${g},${b}`;
                colorMap.set(key, (colorMap.get(key) || 0) + 1);
            }
        }
        
        // 가장자리 색상도 배경색 후보에 추가
        edgeSamples.forEach(sample => {
            const r = Math.floor(sample.r / 15) * 15;
            const g = Math.floor(sample.g / 15) * 15;
            const b = Math.floor(sample.b / 15) * 15;
            const key = `${r},${g},${b}`;
            colorMap.set(key, (colorMap.get(key) || 0) + 10); // 가장자리는 가중치 높게
        });
        
        // 가장 많은 색상 찾기 (배경색)
        let maxCount = 0;
        let bgColor = null;
        for (const [color, count] of colorMap.entries()) {
            if (count > maxCount) {
                maxCount = count;
                bgColor = color;
            }
        }
        
        const [bgR, bgG, bgB] = bgColor ? bgColor.split(',').map(Number) : [0, 0, 0];
        const bgThreshold = isSmallRegion ? 25 : 40; // 작은 영역일 때는 더 낮은 임계값

        const coloredPixels = [];

        // 배경색과 다른 픽셀 찾기 (조각 아이콘)
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const a = data[i + 3];

                // 배경색과의 차이 계산 (유클리드 거리 사용)
                const colorDiff = Math.sqrt(
                    Math.pow(r - bgR, 2) + 
                    Math.pow(g - bgG, 2) + 
                    Math.pow(b - bgB, 2)
                );

                // 배경색과 충분히 다르고, 투명도가 충분한 픽셀
                if (a > 200 && colorDiff > bgThreshold) {
                    coloredPixels.push({ x, y, r, g, b });
                }
            }
        }

        if (coloredPixels.length === 0) {
            if (!isSmallRegion) {
                console.log('조각 아이콘을 찾을 수 없음');
            }
            return null;
        }

        // 연결된 픽셀 그룹 찾기 (Flood Fill 알고리즘)
        const groups = findConnectedGroups(coloredPixels, width, height);
        
        // 가장 큰 그룹 찾기 (조각 아이콘일 가능성이 높음)
        let largestGroup = groups[0];
        for (const group of groups) {
            if (group.length > largestGroup.length) {
                largestGroup = group;
            }
        }

        // Calculate bounding box of largest group
        const minX = Math.min(...largestGroup.map(p => p.x));
        const maxX = Math.max(...largestGroup.map(p => p.x));
        const minY = Math.min(...largestGroup.map(p => p.y));
        const maxY = Math.max(...largestGroup.map(p => p.y));

        const shapeWidth = maxX - minX + 1;
        const shapeHeight = maxY - minY + 1;

        console.log(`Shape dimensions: ${shapeWidth}x${shapeHeight}, pixels: ${largestGroup.length}, groups: ${groups.length}`);

        // 크기만 측정 모드 (1x1 기준 찾기용)
        if (sizeOnly) {
            return {
                width: shapeWidth,
                height: shapeHeight,
                area: largestGroup.length
            };
        }

        // 픽셀 패턴 분석으로 조각 모양 추정 시도
        let pieceName = analyzePiecePattern(largestGroup, shapeWidth, shapeHeight);
        
        // 패턴 분석이 실패하면 크기 기반 추정 사용 (1x1 기준 사용)
        if (!pieceName) {
            pieceName = estimatePieceFromDimensions(shapeWidth, shapeHeight, largestGroup, baseUnitSize);
        }
        
        return { pieceName, coloredPixels: largestGroup.length };
    }

    // 연결된 픽셀 그룹 찾기 (Flood Fill)
    function findConnectedGroups(pixels, width, height) {
        if (pixels.length === 0) return [];
        
        const pixelSet = new Set(pixels.map(p => `${p.x},${p.y}`));
        const visited = new Set();
        const groups = [];
        
        for (const pixel of pixels) {
            const key = `${pixel.x},${pixel.y}`;
            if (visited.has(key)) continue;
            
            // Flood Fill로 연결된 픽셀 찾기
            const group = [];
            const stack = [pixel];
            
            while (stack.length > 0) {
                const current = stack.pop();
                const currentKey = `${current.x},${current.y}`;
                
                if (visited.has(currentKey)) continue;
                visited.add(currentKey);
                group.push(current);
                
                // 4방향 이웃 확인
                const neighbors = [
                    { x: current.x + 1, y: current.y },
                    { x: current.x - 1, y: current.y },
                    { x: current.x, y: current.y + 1 },
                    { x: current.x, y: current.y - 1 }
                ];
                
                for (const neighbor of neighbors) {
                    const neighborKey = `${neighbor.x},${neighbor.y}`;
                    if (pixelSet.has(neighborKey) && !visited.has(neighborKey)) {
                        const neighborPixel = pixels.find(p => p.x === neighbor.x && p.y === neighbor.y);
                        if (neighborPixel) {
                            stack.push(neighborPixel);
                        }
                    }
                }
            }
            
            if (group.length > 5) { // 최소 5개 픽셀 이상인 그룹만
                groups.push(group);
            }
        }
        
        return groups;
    }

    function analyzePieceIcon(canvas, ctx, countBbox) {
        // Estimate piece icon location (above the count text)
        const iconHeight = Math.min(countBbox.y0 - 10, 100); // Icon is above count
        const iconWidth = countBbox.x1 - countBbox.x0;
        const iconX = countBbox.x0;
        const iconY = Math.max(0, countBbox.y0 - iconHeight - 50);

        // Extract pixel data from estimated icon region
        const imageData = ctx.getImageData(iconX, iconY, iconWidth, iconHeight);

        // Analyze pixel pattern to detect piece shape
        const shapeInfo = detectPieceShape(imageData);

        return shapeInfo;
    }

    function detectPieceShape(imageData) {
        const { data, width, height } = imageData;

        // Find colored pixels (non-background)
        const coloredPixels = [];
        const threshold = 100; // Color intensity threshold

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const a = data[i + 3];

                // Check if pixel is colored (not background)
                if (a > 200 && (r > threshold || g > threshold || b > threshold)) {
                    coloredPixels.push({ x, y, r, g, b });
                }
            }
        }

        if (coloredPixels.length === 0) {
            return null;
        }

        // Calculate bounding box of colored region
        const minX = Math.min(...coloredPixels.map(p => p.x));
        const maxX = Math.max(...coloredPixels.map(p => p.x));
        const minY = Math.min(...coloredPixels.map(p => p.y));
        const maxY = Math.max(...coloredPixels.map(p => p.y));

        const shapeWidth = maxX - minX + 1;
        const shapeHeight = maxY - minY + 1;

        // Estimate piece type based on dimensions
        const pieceName = estimatePieceFromDimensions(shapeWidth, shapeHeight, coloredPixels);

        // Determine grade from color
        const avgColor = {
            r: coloredPixels.reduce((sum, p) => sum + p.r, 0) / coloredPixels.length,
            g: coloredPixels.reduce((sum, p) => sum + p.g, 0) / coloredPixels.length,
            b: coloredPixels.reduce((sum, p) => sum + p.b, 0) / coloredPixels.length
        };

        const grade = estimateGradeFromColor(avgColor);

        return { pieceName, grade };
    }

    function estimatePieceFromDimensions(width, height, pixels, baseUnitSize = null) {
        const ratio = width / height;
        const area = pixels.length;

        console.log(`조각 추정: ${width}x${height}, 비율=${ratio.toFixed(2)}, 픽셀=${area}`);

        // 너무 큰 영역은 조각 아이콘이 아닐 가능성이 높음
        if (width > 200 || height > 200 || area > 100000) {
            console.log('영역이 너무 큼 - 조각 아이콘이 아님');
            return null;
        }

        // 1x1 기준 단위가 있으면 상대 크기로 판단
        if (baseUnitSize) {
            const relativeWidth = width / baseUnitSize.width;
            const relativeHeight = height / baseUnitSize.height;
            const relativeArea = area / baseUnitSize.area;
            
            console.log(`1x1 기준 상대 크기: ${relativeWidth.toFixed(2)}x${relativeHeight.toFixed(2)}, 면적 비율=${relativeArea.toFixed(2)}`);
            
            // 1x1 기준으로 몇 칸인지 계산 (반올림)
            const gridWidth = Math.round(relativeWidth);
            const gridHeight = Math.round(relativeHeight);
            const gridArea = Math.round(relativeArea);
            
            console.log(`격자 크기 추정: ${gridWidth}x${gridHeight} (면적: ${gridArea})`);
            
            // 격자 크기로 조각 모양 판단
            if (gridWidth === 1 && gridHeight === 1) {
                return '1x1';
            }
            
            if (gridWidth === 2 && gridHeight === 2) {
                return '2x2';
            }
            
            if (gridWidth === 1 && gridHeight === 2) {
                return '1x2';
            }
            
            if (gridWidth === 1 && gridHeight === 3) {
                return '1x3';
            }
            
            if (gridWidth === 1 && gridHeight === 4) {
                return '1x4';
            }
            
            if (gridWidth === 2 && gridHeight === 1) {
                return '1x2'; // 가로 1x2
            }
            
            if (gridWidth === 3 && gridHeight === 1) {
                return '1x3'; // 가로 1x3
            }
            
            if (gridWidth === 4 && gridHeight === 1) {
                return '1x4'; // 가로 1x4
            }
            
            // L자 모양: 면적이 3이고, 가로/세로가 2x2가 아님
            if (gridArea === 3 && !(gridWidth === 2 && gridHeight === 2)) {
                return 'L3';
            }
            
            // 면적이 3인데 정사각형이면 L3로 추정
            if (gridArea === 3) {
                return 'L3';
            }
        }

        // 1x1 기준이 없으면 기존 방식 사용 (비율 + 면적)
        // 조각 아이콘의 실제 모양을 분석
        // 픽셀 분포를 분석하여 L자, 막대, 정사각형 등을 구분
        
        // 1. 정사각형에 가까운 모양 (비율 0.7~1.4)
        if (ratio > 0.7 && ratio < 1.4) {
            if (area < 500) return '1x1';
            if (area < 2000) return '2x2';
            // L자 모양일 가능성 (정사각형이지만 비대칭)
            return 'L3';
        }
        
        // 2. 가로로 긴 모양 (막대)
        if (ratio > 1.4) {
            if (area < 800) return '1x2';
            if (area < 2000) return '1x3';
            if (area < 4000) return '1x4';
            return '1x4';
        }
        
        // 3. 세로로 긴 모양 (막대)
        if (ratio < 0.7) {
            if (area < 800) return '1x2';
            if (area < 2000) return '1x3';
            if (area < 4000) return '1x4';
            return '1x3';
        }

        // 기본값: L자 모양 (가장 흔한 복잡한 모양)
        console.log('복잡한 모양 - L3로 추정');
        return 'L3';
    }
    
    // 조각 아이콘의 픽셀 패턴을 분석하여 실제 모양 추정
    function analyzePiecePattern(pixels, width, height) {
        if (pixels.length === 0) return null;
        
        // 픽셀을 그리드로 변환
        const grid = [];
        for (let y = 0; y < height; y++) {
            grid[y] = [];
            for (let x = 0; x < width; x++) {
                grid[y][x] = false;
            }
        }
        
        pixels.forEach(p => {
            if (p.x >= 0 && p.x < width && p.y >= 0 && p.y < height) {
                grid[p.y][p.x] = true;
            }
        });
        
        // 실제 모양 분석
        // 1. 막대 모양 체크 (가로 또는 세로로 연속된 픽셀)
        const isHorizontalBar = checkHorizontalBar(grid, width, height);
        const isVerticalBar = checkVerticalBar(grid, width, height);
        
        if (isHorizontalBar) {
            const barLength = getHorizontalBarLength(grid, width, height);
            if (barLength <= 2) return '1x2';
            if (barLength <= 3) return '1x3';
            return '1x4';
        }
        
        if (isVerticalBar) {
            const barLength = getVerticalBarLength(grid, width, height);
            if (barLength <= 2) return '1x2';
            if (barLength <= 3) return '1x3';
            return '1x4';
        }
        
        // 2. 정사각형 체크
        if (checkSquare(grid, width, height)) {
            return '2x2';
        }
        
        // 3. L자 모양 체크
        if (checkLShape(grid, width, height)) {
            return 'L3';
        }
        
        return null;
    }
    
    function checkHorizontalBar(grid, width, height) {
        // 가로 막대: 한 행에 대부분의 픽셀이 있고, 다른 행에는 거의 없음
        let maxRowPixels = 0;
        let maxRow = -1;
        let totalRowPixels = 0;
        
        for (let y = 0; y < height; y++) {
            let rowPixels = 0;
            for (let x = 0; x < width; x++) {
                if (grid[y][x]) rowPixels++;
            }
            totalRowPixels += rowPixels;
            if (rowPixels > maxRowPixels) {
                maxRowPixels = rowPixels;
                maxRow = y;
            }
        }
        
        // 최대 행이 전체 픽셀의 60% 이상을 차지하고, 가로 비율이 1.3 이상이면 막대로 간주
        const totalPixels = grid.flat().filter(c => c).length;
        const ratio = width / height;
        return maxRowPixels > totalPixels * 0.6 && ratio > 1.3;
    }
    
    function checkVerticalBar(grid, width, height) {
        // 세로 막대: 한 열에 대부분의 픽셀이 있고, 다른 열에는 거의 없음
        let maxColPixels = 0;
        let maxCol = -1;
        
        for (let x = 0; x < width; x++) {
            let colPixels = 0;
            for (let y = 0; y < height; y++) {
                if (grid[y][x]) colPixels++;
            }
            if (colPixels > maxColPixels) {
                maxColPixels = colPixels;
                maxCol = x;
            }
        }
        
        // 최대 열이 전체 픽셀의 60% 이상을 차지하고, 세로 비율이 0.7 이하면 막대로 간주
        const totalPixels = grid.flat().filter(c => c).length;
        const ratio = width / height;
        return maxColPixels > totalPixels * 0.6 && ratio < 0.7;
    }
    
    function getHorizontalBarLength(grid, width, height) {
        let maxLength = 0;
        for (let y = 0; y < height; y++) {
            let length = 0;
            for (let x = 0; x < width; x++) {
                if (grid[y][x]) {
                    length++;
                } else {
                    maxLength = Math.max(maxLength, length);
                    length = 0;
                }
            }
            maxLength = Math.max(maxLength, length);
        }
        return maxLength;
    }
    
    function getVerticalBarLength(grid, width, height) {
        let maxLength = 0;
        for (let x = 0; x < width; x++) {
            let length = 0;
            for (let y = 0; y < height; y++) {
                if (grid[y][x]) {
                    length++;
                } else {
                    maxLength = Math.max(maxLength, length);
                    length = 0;
                }
            }
            maxLength = Math.max(maxLength, length);
        }
        return maxLength;
    }
    
    function checkSquare(grid, width, height) {
        // 정사각형: 가로와 세로 비율이 비슷하고, 픽셀이 정사각형 영역에 집중
        const ratio = width / height;
        if (ratio < 0.7 || ratio > 1.4) return false;
        
        // 픽셀이 중앙에 집중되어 있는지 확인
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 2;
        
        let centerPixels = 0;
        let totalPixels = 0;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (grid[y][x]) {
                    totalPixels++;
                    const dist = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
                    if (dist < radius) {
                        centerPixels++;
                    }
                }
            }
        }
        
        return centerPixels > totalPixels * 0.6;
    }
    
    function checkLShape(grid, width, height) {
        // L자 모양: 두 개의 막대가 직각으로 만나는 형태
        // 간단한 휴리스틱: 가로 막대와 세로 막대가 모두 존재하지만 완전한 막대는 아님
        const hasHorizontal = checkHorizontalBar(grid, width, height);
        const hasVertical = checkVerticalBar(grid, width, height);
        
        // 둘 다 막대가 아니지만, 가로와 세로 방향 모두에 픽셀이 분산되어 있으면 L자 가능성
        if (!hasHorizontal && !hasVertical) {
            // 픽셀 분포 확인
            let maxRowPixels = 0;
            let maxColPixels = 0;
            
            for (let y = 0; y < height; y++) {
                let rowPixels = 0;
                for (let x = 0; x < width; x++) {
                    if (grid[y][x]) rowPixels++;
                }
                maxRowPixels = Math.max(maxRowPixels, rowPixels);
            }
            
            for (let x = 0; x < width; x++) {
                let colPixels = 0;
                for (let y = 0; y < height; y++) {
                    if (grid[y][x]) colPixels++;
                }
                maxColPixels = Math.max(maxColPixels, colPixels);
            }
            
            const totalPixels = grid.flat().filter(c => c).length;
            // 가로와 세로 모두에 상당한 픽셀이 있으면 L자 가능성
            return maxRowPixels > totalPixels * 0.3 && maxColPixels > totalPixels * 0.3;
        }
        
        return false;
    }

    function estimateGradeFromColor(avgColor) {
        const { r, g, b } = avgColor;

        console.log(`Grade detection - R:${r.toFixed(0)}, G:${g.toFixed(0)}, B:${b.toFixed(0)}`);

        // HSV 변환으로 더 정확한 색상 판단
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;
        
        let h = 0;
        if (delta !== 0) {
            if (max === r) {
                h = ((g - b) / delta) % 6;
            } else if (max === g) {
                h = (b - r) / delta + 2;
            } else {
                h = (r - g) / delta + 4;
            }
        }
        h = Math.round(h * 60);
        if (h < 0) h += 360;
        
        const s = max === 0 ? 0 : delta / max;
        const v = max / 255;

        console.log(`HSV - H:${h}, S:${s.toFixed(2)}, V:${v.toFixed(2)}`);

        // 실제 게임 색상 기준:
        // 레어 = 파랑 배경
        // 에픽 = 보라색 배경
        // 슈퍼에픽 = 빨강 배경

        // 에픽 (보라색 계열) - H: 260-300 (보라색)
        // 보라색은 빨강과 파랑이 섞인 색상이므로 R과 B가 모두 높고 G가 낮음
        if (h >= 260 && h <= 300) {
            console.log('Detected: epic (purple)');
            return 'epic';
        }

        // 레어 (파랑 계열) - H: 200-260 (파란색, 보라색이 아닌 순수 파랑)
        if (h >= 200 && h < 260 && s > 0.3 && v > 0.4) {
            console.log('Detected: rare (blue)');
            return 'rare';
        }

        // 슈퍼에픽 (빨강 계열) - H: 0-20, 340-360 (빨강)
        if ((h >= 0 && h <= 20) || (h >= 340 && h <= 360)) {
            if (s > 0.4 && v > 0.5) {
                console.log('Detected: super (red)');
                return 'super';
            }
        }

        // RGB 기반 폴백 (HSV가 불확실한 경우)
        // 에픽: 보라색 계열 (R과 B가 모두 높고 G가 낮음)
        // 보라색 판단: R과 B가 비슷하게 높고, G는 낮음
        const purpleRatio = (r + b) / (g + 1); // G가 0일 수 있으므로 +1
        if (r > 60 && b > 60 && r > g * 1.2 && b > g * 1.2 && purpleRatio > 2.0) {
            console.log('Detected: epic (purple RGB fallback)');
            return 'epic';
        }

        // 레어: 파랑 계열 (B가 높고 R, G가 낮음, 보라색이 아님)
        if (b > r + 20 && b > g + 20 && b > 80 && purpleRatio < 2.5) {
            console.log('Detected: rare (blue RGB fallback)');
            return 'rare';
        }

        // 슈퍼에픽: 빨강 계열 (R이 높고 G, B가 낮음)
        if (r > 150 && r > g + 30 && r > b + 30 && g < 120 && b < 120) {
            console.log('Detected: super (red RGB fallback)');
            return 'super';
        }

        // Default to rare
        console.log('Detected: rare (default)');
        return 'rare';
    }

    function fillPiecesFromVision(pieceData) {
        // Clear all inputs first
        Object.entries(PIECES).forEach(([name, piece]) => {
            const grades = ['rare', 'epic', 'super'];
            grades.forEach(grade => {
                const countInput = document.getElementById(`piece-count-${name}-${grade}`);
                if (countInput) {
                    countInput.value = '0';
                }
            });
        });

        // 1단계: 같은 조각(pieceName + grade)을 그룹화하고 count 합산
        const pieceCountMap = new Map(); // key: "pieceName-grade", value: total count
        
        pieceData.forEach((data, index) => {
            const { pieceName, grade, count } = data;
            const countValue = count !== undefined ? count : 1; // count가 없으면 1로 가정

            if (pieceName && grade) {
                // 조각 이름과 등급이 모두 인식된 경우
                const key = `${pieceName}-${grade}`;
                const currentCount = pieceCountMap.get(key) || 0;
                pieceCountMap.set(key, currentCount + countValue);
                console.log(`조각 카운트: ${pieceName} (${grade}) = ${currentCount + countValue} (기존: ${currentCount}, 추가: ${countValue})`);
            }
        });

        // 2단계: 합산된 count를 입력 필드에 입력
        let successCount = 0;
        let partialCount = 0;
        const unmatchedPieces = []; // 매칭되지 않은 조각들
        const usedInputs = new Set(); // 이미 사용된 입력 필드 추적

        pieceCountMap.forEach((totalCount, key) => {
            const [pieceName, grade] = key.split('-');
            const inputId = `piece-count-${pieceName}-${grade}`;
            const countInput = document.getElementById(inputId);
            
            if (countInput) {
                countInput.value = totalCount.toString();
                usedInputs.add(inputId); // 사용된 입력 필드로 표시
                successCount++;
                console.log(`✅ 조각 인식 성공: ${pieceName} (${grade}) = ${totalCount}`);
            } else {
                // 입력 필드를 찾을 수 없는 경우
                unmatchedPieces.push({ pieceName, grade, count: totalCount });
                partialCount++;
                console.log(`⚠️ 입력 필드 없음: ${pieceName} (${grade}) = ${totalCount}`);
            }
        });

        // 3단계: 조각 이름이나 등급이 인식되지 않은 조각들 처리
        pieceData.forEach((data, index) => {
            const { pieceName, grade, count } = data;
            const countValue = count !== undefined ? count : 1;

            if (!pieceName || !grade) {
                // 조각 이름이나 등급이 인식되지 않은 경우
                unmatchedPieces.push({ grade: grade || 'rare', count: countValue, index });
                partialCount++;
                if (!pieceName && !grade) {
                    console.log(`⚠️ 개수만 인식: ${countValue}`);
                } else if (!pieceName) {
                    console.log(`⚠️ 부분 인식: 등급=${grade}, 개수=${countValue}, 조각명=미인식`);
                }
            }
        });

        // 매칭되지 않은 조각들을 순서대로 배치
        // 조각 목록을 순서대로 가져오기 (palette에 표시된 순서)
        const pieceNames = Object.keys(PIECES);
        
        // 각 조각을 순서대로 다른 입력 필드에 배치 (중복 방지)
        unmatchedPieces.forEach((unmatched, idx) => {
            // 현재 인덱스부터 시작해서 해당 등급의 조각 찾기
            let found = false;
            for (let i = 0; i < pieceNames.length && !found; i++) {
                const name = pieceNames[i];
                const inputId = `piece-count-${name}-${unmatched.grade}`;
                
                // 이미 사용된 입력 필드는 건너뛰기
                if (usedInputs.has(inputId)) continue;
                
                const countInput = document.getElementById(inputId);
                if (countInput && countInput.value === '0') {
                    countInput.value = unmatched.count.toString();
                    usedInputs.add(inputId);
                    partialCount++;
                    console.log(`📝 순서 매칭: ${name} (${unmatched.grade}) = ${unmatched.count}`);
                    found = true;
                }
            }
            
            // 해당 등급에서 찾지 못하면 다른 등급도 시도
            if (!found) {
                const grades = ['rare', 'epic', 'super'];
                for (let i = 0; i < pieceNames.length && !found; i++) {
                    const name = pieceNames[i];
                    for (const grade of grades) {
                        const inputId = `piece-count-${name}-${grade}`;
                        
                        // 이미 사용된 입력 필드는 건너뛰기
                        if (usedInputs.has(inputId)) continue;
                        
                        const countInput = document.getElementById(inputId);
                        if (countInput && countInput.value === '0') {
                            countInput.value = unmatched.count.toString();
                            usedInputs.add(inputId);
                            partialCount++;
                            console.log(`📝 순서 매칭 (등급 변경): ${name} (${grade}) = ${unmatched.count}`);
                            found = true;
                            break;
                        }
                    }
                }
            }
        });

        // 결과 메시지
        const totalRecognizedPieces = pieceCountMap.size;
        const totalCount = Array.from(pieceCountMap.values()).reduce((sum, count) => sum + count, 0);
        
        if (successCount > 0) {
            solutionSummary.textContent = `✅ ${totalRecognizedPieces}종류의 조각을 인식했습니다! (총 ${totalCount}개)${partialCount > 0 ? ` (${partialCount}개 부분 인식)` : ''}`;
            solutionSummary.style.color = '#10b981';
        } else if (partialCount > 0) {
            solutionSummary.textContent = `⚠️ ${partialCount}개의 조각 개수를 인식했지만, 조각 종류나 등급을 확인할 수 없습니다. 수동으로 확인해주세요.`;
            solutionSummary.style.color = '#f59e0b';
        } else {
            solutionSummary.textContent = `❌ 조각 정보를 인식할 수 없습니다. 이미지 품질을 확인하거나 수동으로 입력해주세요.`;
            solutionSummary.style.color = '#f5576c';
        }
        
        solutionsContainer.innerHTML = '';
    }

    // 유사한 조각 이름 찾기 (부분 매칭)
    function findSimilarPiece(pieceName) {
        if (!pieceName) return null;
        
        const pieceNames = Object.keys(PIECES);
        const lowerPieceName = pieceName.toLowerCase();
        
        // 정확한 매칭
        if (pieceNames.includes(pieceName)) {
            return pieceName;
        }
        
        // 부분 매칭 (예: "1x1_1" → "1x1")
        const baseName = pieceName.split('_')[0];
        const matchingPiece = pieceNames.find(name => name.startsWith(baseName));
        if (matchingPiece) {
            return matchingPiece;
        }
        
        // 유사도 기반 매칭
        let bestMatch = null;
        let bestScore = 0;
        
        pieceNames.forEach(name => {
            const score = calculateSimilarity(lowerPieceName, name.toLowerCase());
            if (score > bestScore && score > 0.5) {
                bestScore = score;
                bestMatch = name;
            }
        });
        
        return bestMatch;
    }

    // 문자열 유사도 계산 (간단한 Levenshtein 거리 기반)
    function calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const distance = levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    function levenshteinDistance(str1, str2) {
        const matrix = [];
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[str2.length][str1.length];
    }

    function fillPiecesFromOCR(numbers) {
        // Clear all existing inputs first
        Object.entries(PIECES).forEach(([name, piece]) => {
            const grades = ['rare', 'epic', 'super'];
            grades.forEach(grade => {
                const countInput = document.getElementById(`piece-count-${name}-${grade}`);
                if (countInput) {
                    countInput.value = '0';
                }
            });
        });

        // Strategy: Fill sequentially based on piece order in PIECES
        // User can adjust manually if needed
        let numberIndex = 0;
        const pieceNames = Object.keys(PIECES);
        const grades = ['rare', 'epic', 'super'];

        // Fill each piece-grade combination with available numbers
        for (let i = 0; i < pieceNames.length && numberIndex < numbers.length; i++) {
            for (let j = 0; j < grades.length && numberIndex < numbers.length; j++) {
                const name = pieceNames[i];
                const grade = grades[j];
                const countInput = document.getElementById(`piece-count-${name}-${grade}`);

                if (countInput) {
                    const value = parseInt(numbers[numberIndex], 10);
                    // Only use reasonable numbers (0-99)
                    if (value >= 0 && value <= 99) {
                        countInput.value = value.toString();
                        numberIndex++;
                    }
                }
            }
        }

        solutionSummary.textContent = `📷 OCR로 ${numberIndex}개의 조각 정보를 입력했습니다!`;
        solutionsContainer.innerHTML = '';
    }


// 새로운 이미지 기반 조각 인식 시스템 (OCR 제거)
async function recognizePiecesWithCV(file) {
    console.log("Starting image-based piece recognition...");

    // 1. 이미지 로드
    const img = new Image();
    await new Promise(resolve => {
        img.onload = resolve;
        img.src = URL.createObjectURL(file);
    });

    console.log(`Image loaded: ${img.width}x${img.height}`);

    // 2. OpenCV Mat으로 변환
    const src = cv.imread(img);
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // 3. 조각 박스 감지
    const boxes = detectPieceBoxes(src, gray, img);
    console.log(`Detected ${boxes.length} piece boxes`);

    if (boxes.length === 0) {
        src.delete();
        gray.delete();
        URL.revokeObjectURL(img.src);
        return [];
    }

    // 4. 각 박스에서 조각 패턴 추출 및 매칭
    const pieceCounts = {}; // { pieceName-grade: count }

    for (let i = 0; i < boxes.length; i++) {
        const box = boxes[i];

        // 배경색으로 등급 판별
        const { grade, bgColor } = detectGradeFromBox(src, box);

        // 그리드 분석으로 조각 모양 추출 (배경색 기반)
        const extractedShape = extractShapeFromImage(src, box, bgColor, i);

        console.log(`Piece ${i}: Extracted shape:`, extractedShape);

        // 추출한 모양으로 조각 이름 찾기
        const pieceName = findPieceNameByShape(extractedShape);

        if (pieceName) {
            const key = `${pieceName}-${grade}`;
            pieceCounts[key] = (pieceCounts[key] || 0) + 1;
            console.log(`✓ Piece ${i}: ${pieceName} (${grade})`);
        } else {
            console.warn(`✗ Piece ${i}: Could not identify (shape: ${JSON.stringify(extractedShape)})`);
        }
    }

    // 5. 결과를 배열로 변환
    const result = [];
    for (const [key, count] of Object.entries(pieceCounts)) {
        const [pieceName, grade] = key.split('-');
        result.push({
            pieceName: pieceName,
            grade: grade,
            count: count
        });
    }

    // 6. 메모리 정리
    src.delete();
    gray.delete();
    URL.revokeObjectURL(img.src);

    console.log(`Recognition complete: ${result.length} piece types found`);
    return result;
}

// 조각 박스 감지
function detectPieceBoxes(src, gray, img) {
    // 이진화
    const binary = new cv.Mat();
    cv.threshold(gray, binary, 128, 255, cv.THRESH_BINARY);

    // 윤곽선 검출
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    console.log(`Found ${contours.size()} contours`);

    // 조각 박스 필터링
    const minArea = (img.width / 20) * (img.height / 20); // 최소 면적
    const maxArea = (img.width / 5) * (img.height / 5);   // 최대 면적

    const boxes = [];
    for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);

        if (area > minArea && area < maxArea) {
            const rect = cv.boundingRect(contour);

            // 종횡비 확인 (조각 박스는 대략 정사각형)
            const aspectRatio = rect.width / rect.height;
            if (aspectRatio > 0.5 && aspectRatio < 2.0) {
                boxes.push(rect);
            }
        }
    }

    // 레이아웃 감지: 가로 배치 vs 그리드 배치
    // Y 좌표 분산이 작으면 가로 배치, 크면 그리드 배치
    const yValues = boxes.map(b => b.y);
    const avgY = yValues.reduce((sum, y) => sum + y, 0) / yValues.length;
    const yVariance = yValues.reduce((sum, y) => sum + Math.pow(y - avgY, 2), 0) / yValues.length;
    const yStdDev = Math.sqrt(yVariance);

    console.log(`Y standard deviation: ${yStdDev.toFixed(1)} (threshold: ${img.height / 10})`);

    // 그리드 레이아웃 감지 (Y 좌표 변동이 크면)
    const isGridLayout = yStdDev > img.height / 10;

    if (isGridLayout) {
        // 그리드: Y 좌표로 먼저 정렬 (위->아래), 같은 행에서는 X로 정렬 (왼->오)
        console.log('Grid layout detected - sorting by rows');
        boxes.sort((a, b) => {
            const rowDiff = a.y - b.y;
            if (Math.abs(rowDiff) > img.height / 20) {
                return rowDiff; // 다른 행
            }
            return a.x - b.x; // 같은 행
        });
    } else {
        // 가로 배치: X 좌표로만 정렬 (왼쪽에서 오른쪽)
        console.log('Horizontal layout detected - sorting left to right');
        boxes.sort((a, b) => a.x - b.x);

        // 가로 배치에서는 첫 번째 박스의 Y 좌표와 높이를 기준으로 모든 박스 정렬
        if (boxes.length > 0) {
            const referenceY = boxes[0].y;
            const referenceHeight = boxes[0].height;

            console.log(`Aligning all boxes to first box: y=${referenceY}, height=${referenceHeight}`);

            boxes.forEach(box => {
                box.y = referenceY;
                box.height = referenceHeight;
            });
        }
    }

    // 메모리 정리
    binary.delete();
    contours.delete();
    hierarchy.delete();

    return boxes;
}

// 배경색으로 등급 판별 (배경색도 반환)
function detectGradeFromBox(src, box) {
    // 박스의 상단 10% 영역에서 배경색 샘플링
    const sampleHeight = Math.floor(box.height * 0.1);
    const sampleY = box.y + 5; // 약간 아래에서 샘플링

    // ROI 추출
    const roi = src.roi(new cv.Rect(box.x + 5, sampleY, box.width - 10, sampleHeight));

    // 평균 색상 계산
    const mean = cv.mean(roi);
    roi.delete();

    const r = mean[0];
    const g = mean[1];
    const b = mean[2];

    console.log(`  Background color: R=${r.toFixed(0)}, G=${g.toFixed(0)}, B=${b.toFixed(0)}`);

    // 색상 기반 등급 판별
    // 레어: 파란색 (B가 가장 높음)
    // 에픽: 보라색 (R과 B가 모두 높음)
    // 슈퍼: 빨간색/노란색 (R이 매우 높음)

    let grade;
    // 보라색 (epic): R과 B가 모두 높음
    if (r > 150 && b > 200 && b > r) {
        grade = 'epic';
    }
    // 파란색 (rare): B가 가장 높음
    else if (b > r + 30 && b > g + 20) {
        grade = 'rare';
    }
    // 빨간색/분홍색 (super): R이 매우 높음
    else if (r > 200 && r > b + 30) {
        grade = 'super';
    }
    // 노란색 (super): R과 G가 높음
    else if (r > 150 && g > 150 && b < 100) {
        grade = 'super';
    }
    else {
        grade = 'rare';
    }

    return {
        grade: grade,
        bgColor: { r: r, g: g, b: b }
    };
}

// 조각 아이콘 이미지 해시 추출
function extractIconHash(src, box, index, debugContainer) {
    // 박스에서 아이콘 추출 (상단 "장착중" 태그 제외)
    const marginLeft = 0.15;   // 좌측 15% 제외
    const marginRight = 0.15;  // 우측 15% 제외
    const marginTop = 0.25;    // 상단 25% 제외 (장착중 태그)
    const marginBottom = 0.15; // 하단 15% 제외

    const iconX = box.x + Math.floor(box.width * marginLeft);
    const iconY = box.y + Math.floor(box.height * marginTop);
    const iconW = Math.floor(box.width * (1 - marginLeft - marginRight));
    const iconH = Math.floor(box.height * (1 - marginTop - marginBottom));

    // ROI 추출
    const iconRoi = src.roi(new cv.Rect(iconX, iconY, iconW, iconH));

    // 그레이스케일 변환
    const grayIcon = new cv.Mat();
    cv.cvtColor(iconRoi, grayIcon, cv.COLOR_RGBA2GRAY);

    // 이진화 (형태만 추출, 색상 무시)
    const binaryIcon = new cv.Mat();
    cv.threshold(grayIcon, binaryIcon, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);

    // 8x8로 리사이즈 (해시 생성용)
    const small = new cv.Mat();
    cv.resize(binaryIcon, small, new cv.Size(8, 8), 0, 0, cv.INTER_AREA);

    // 평균 해시 계산 (리사이즈된 윤곽선 이미지 사용)
    let sum = 0;
    const pixels = [];
    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            const pixel = small.ucharPtr(y, x)[0];
            pixels.push(pixel);
            sum += pixel;
        }
    }
    const avg = sum / 64;

    // 디버깅: 픽셀 값 확인
    if (index < 3) {
        console.log(`Piece ${index} pixels:`, pixels.slice(0, 16), '... avg:', avg);
    }

    // 평균보다 밝으면 1, 어두우면 0
    let hash = '';
    let onesCount = 0;
    for (let i = 0; i < 64; i++) {
        const bit = pixels[i] >= avg ? '1' : '0';
        hash += bit;
        if (bit === '1') onesCount++;
    }

    // 디버깅: 해시 정보
    if (index < 3) {
        console.log(`Piece ${index} hash:`, hash, `(${onesCount}/64 ones)`);
    }

    // 디버깅 정보 표시
    if (debugContainer) {
        const debugItem = document.createElement('div');
        debugItem.style.cssText = 'border: 2px solid #333; padding: 5px; background: white; text-align: center;';

        const title = document.createElement('div');
        title.textContent = `#${index}`;
        title.style.fontWeight = 'bold';
        debugItem.appendChild(title);

        // 원본 아이콘
        const originalCanvas = document.createElement('canvas');
        cv.imshow(originalCanvas, iconRoi);
        originalCanvas.style.width = '80px';
        originalCanvas.style.height = '80px';
        originalCanvas.style.imageRendering = 'pixelated';
        originalCanvas.style.border = '1px solid #ccc';
        const originalLabel = document.createElement('div');
        originalLabel.textContent = '원본';
        originalLabel.style.fontSize = '10px';
        debugItem.appendChild(originalLabel);
        debugItem.appendChild(originalCanvas);

        // 무늬 제거 이미지 (실제 비교 이미지)
        const closedCanvas = document.createElement('canvas');
        cv.imshow(closedCanvas, closed);
        closedCanvas.style.width = '80px';
        closedCanvas.style.height = '80px';
        closedCanvas.style.imageRendering = 'pixelated';
        closedCanvas.style.border = '1px solid #333';
        const closedLabel = document.createElement('div');
        closedLabel.textContent = '비교용';
        closedLabel.style.fontSize = '10px';
        closedLabel.style.marginTop = '5px';
        debugItem.appendChild(closedLabel);
        debugItem.appendChild(closedCanvas);

        const hashInfo = document.createElement('div');
        hashInfo.style.fontSize = '9px';
        hashInfo.style.wordBreak = 'break-all';
        hashInfo.style.maxWidth = '100px';
        hashInfo.style.marginTop = '5px';
        hashInfo.textContent = `avg=${avg.toFixed(1)}, hash=${hash.substring(0, 16)}...`;
        debugItem.appendChild(hashInfo);

        debugContainer.appendChild(debugItem);
    }

    // 메모리 정리
    iconRoi.delete();
    small.delete();
    grayIcon.delete();
    blurred.delete();
    binaryIcon.delete();
    closed.delete();

    return { hash: hash, avg: avg, pixels: pixels };
}

// 같은 해시를 가진 조각들 그룹핑
function groupPiecesByHash(pieces) {
    const hashMap = new Map();

    pieces.forEach(piece => {
        const hash = piece.hash;

        // 유사한 해시 찾기 (Hamming 거리 < 15)
        let foundGroup = null;
        for (const [groupHash, group] of hashMap.entries()) {
            const distance = hammingDistance(hash, groupHash);
            if (distance < 15) { // 유사도 임계값 (더 관대하게)
                foundGroup = groupHash;
                break;
            }
        }

        if (foundGroup) {
            hashMap.get(foundGroup).push(piece);
        } else {
            hashMap.set(hash, [piece]);
        }
    });

    return Array.from(hashMap.values());
}

// Hamming 거리 계산 (두 해시의 차이)
function hammingDistance(hash1, hash2) {
    let distance = 0;
    for (let i = 0; i < hash1.length && i < hash2.length; i++) {
        if (hash1[i] !== hash2[i]) distance++;
    }
    return distance;
}

// 조각 이미지에서 그리드 패턴 추출 (1x1 칸 단위로 분석, 배경색 기반)
function extractShapeFromImage(src, box, bgColor, index) {
    // 고정 여백 사용 (간단하고 안정적)
    const marginLeft = 0.08;
    const marginRight = 0.08;
    const marginTop = 0.08;  // 작은 여백만 (태그 없는 이미지 대응)
    const marginBottom = 0.08;

    const iconX = box.x + Math.floor(box.width * marginLeft);
    const iconY = box.y + Math.floor(box.height * marginTop);
    const iconW = Math.floor(box.width * (1 - marginLeft - marginRight));
    const iconH = Math.floor(box.height * (1 - marginTop - marginBottom));

    const iconRoi = src.roi(new cv.Rect(iconX, iconY, iconW, iconH));
    const result = extractShapeFromRoi(iconRoi, bgColor, index);
    iconRoi.delete();

    return result;
}

// ROI에서 그리드 패턴 추출 (하이브리드: 엣지 + 색상 기반)
function extractShapeFromRoi(iconRoi, bgColor, index) {
    const iconW = iconRoi.cols;
    const iconH = iconRoi.rows;

    // 하이브리드 접근: 엣지 검출 + 색상 기반
    const binary = new cv.Mat();
    const gray = new cv.Mat();

    // === 방법 1: 엣지 검출 (테두리 기반) ===
    cv.cvtColor(iconRoi, gray, cv.COLOR_RGBA2GRAY);

    // Canny 엣지 검출
    const edges = new cv.Mat();
    cv.Canny(gray, edges, 30, 100);

    // 엣지를 두껍게 (테두리 연결)
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
    cv.dilate(edges, edges, kernel);

    // 윤곽선 찾기
    const edgeContours = new cv.MatVector();
    const edgeHierarchy = new cv.Mat();
    cv.findContours(edges, edgeContours, edgeHierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // 가장 큰 윤곽선 찾기 (조각일 가능성 높음)
    let maxArea = 0;
    let maxContourIdx = -1;
    for (let i = 0; i < edgeContours.size(); i++) {
        const area = cv.contourArea(edgeContours.get(i));
        if (area > maxArea) {
            maxArea = area;
            maxContourIdx = i;
        }
    }

    // 엣지 기반 마스크 생성
    const edgeMask = cv.Mat.zeros(iconH, iconW, cv.CV_8UC1);
    if (maxContourIdx >= 0) {
        cv.drawContours(edgeMask, edgeContours, maxContourIdx, new cv.Scalar(255), cv.FILLED);
    }

    edgeContours.delete();
    edgeHierarchy.delete();
    edges.delete();

    // === 방법 2: 색상 기반 (배경 제거) ===
    const tolerance = 60;
    const lower = new cv.Mat(iconRoi.rows, iconRoi.cols, iconRoi.type(),
        [Math.max(0, bgColor.r - tolerance),
         Math.max(0, bgColor.g - tolerance),
         Math.max(0, bgColor.b - tolerance),
         0]);
    const upper = new cv.Mat(iconRoi.rows, iconRoi.cols, iconRoi.type(),
        [Math.min(255, bgColor.r + tolerance),
         Math.min(255, bgColor.g + tolerance),
         Math.min(255, bgColor.b + tolerance),
         255]);

    const colorMask = new cv.Mat();
    cv.inRange(iconRoi, lower, upper, colorMask);
    cv.bitwise_not(colorMask, colorMask); // 반전

    lower.delete();
    upper.delete();

    // === 두 마스크 결합 (OR 연산) ===
    cv.bitwise_or(edgeMask, colorMask, binary);

    edgeMask.delete();
    colorMask.delete();
    gray.delete();

    // 모폴로지 연산: 노이즈 제거
    cv.morphologyEx(binary, binary, cv.MORPH_OPEN, kernel);
    cv.morphologyEx(binary, binary, cv.MORPH_CLOSE, kernel);
    kernel.delete();

    // 최종 윤곽선 찾고 내부 채우기
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const contourCount = contours.size();

    // 모든 윤곽선의 내부를 흰색으로 채우기
    for (let i = 0; i < contourCount; i++) {
        cv.drawContours(binary, contours, i, new cv.Scalar(255), cv.FILLED);
    }

    contours.delete();
    hierarchy.delete();

    if (index === 0) {
        console.log(`  Filled ${contourCount} contours (hybrid: edge + color)`);
    }

    // 실제 조각의 bounding box 찾기
    let minX = iconW, maxX = 0, minY = iconH, maxY = 0;
    let totalFilled = 0;

    for (let y = 0; y < iconH; y++) {
        for (let x = 0; x < iconW; x++) {
            const pixel = binary.ucharPtr(y, x)[0];
            if (pixel > 128) {
                totalFilled++;
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }
        }
    }

    // 조각이 없으면 빈 배열 반환
    if (totalFilled === 0) {
        console.warn(`  No filled pixels found! Background color might be too similar to piece color.`);
        binary.delete();
        return [];
    }

    // 조각의 실제 크기
    const pieceW = maxX - minX + 1;
    const pieceH = maxY - minY + 1;

    console.log(`  Bounding box: minX=${minX}, maxX=${maxX}, minY=${minY}, maxY=${maxY}, totalFilled=${totalFilled}`);

    // 셀 크기 추정 (가장 작은 변을 기준으로)
    const minDim = Math.min(pieceW, pieceH);
    const estimatedCellSize = minDim / Math.max(1, Math.floor(minDim / 20)); // 대략 20px per cell

    // 그리드 크기 계산
    const gridCols = Math.max(1, Math.round(pieceW / estimatedCellSize));
    const gridRows = Math.max(1, Math.round(pieceH / estimatedCellSize));

    // 그리드 크기 제한 (1~5칸)
    const finalGridCols = Math.min(5, Math.max(1, gridCols));
    const finalGridRows = Math.min(5, Math.max(1, gridRows));

    const cellWidth = pieceW / finalGridCols;
    const cellHeight = pieceH / finalGridRows;

    console.log(`  Grid analysis: piece=${pieceW}x${pieceH}, grid=${finalGridRows}x${finalGridCols}, cell=${cellWidth.toFixed(1)}x${cellHeight.toFixed(1)}`);

    // 각 그리드 칸 검사
    const shape = [];
    for (let row = 0; row < finalGridRows; row++) {
        for (let col = 0; col < finalGridCols; col++) {
            const cellX = minX + col * cellWidth;
            const cellY = minY + row * cellHeight;

            // 셀 영역의 픽셀 샘플링 (70% 영역)
            const sampleMargin = 0.15;
            const sampleX = Math.floor(cellX + cellWidth * sampleMargin);
            const sampleY = Math.floor(cellY + cellHeight * sampleMargin);
            const sampleW = Math.floor(cellWidth * (1 - sampleMargin * 2));
            const sampleH = Math.floor(cellHeight * (1 - sampleMargin * 2));

            if (sampleW > 0 && sampleH > 0 &&
                sampleX + sampleW <= iconW &&
                sampleY + sampleH <= iconH) {

                const cellRoi = binary.roi(new cv.Rect(sampleX, sampleY, sampleW, sampleH));
                const mean = cv.mean(cellRoi);
                cellRoi.delete();

                // 디버그: 첫 번째 조각의 각 셀 밝기 출력
                if (index === 0) {
                    console.log(`    Cell [${row},${col}]: mean=${mean[0].toFixed(1)}, filled=${mean[0] > 128}`);
                }

                // 평균 밝기가 128 이상이면 채워진 칸
                if (mean[0] > 128) {
                    shape.push([row, col]);
                }
            } else {
                if (index === 0) {
                    console.log(`    Cell [${row},${col}]: OUT OF BOUNDS (sampleW=${sampleW}, sampleH=${sampleH})`);
                }
            }
        }
    }

    // 패턴 정규화
    const bestMatch = normalizeShape(shape);

    binary.delete();

    return bestMatch || [];
}

// 조각 패턴 정규화 (좌상단 정렬)
function normalizeShape(shape) {
    if (shape.length === 0) return [];

    const minRow = Math.min(...shape.map(p => p[0]));
    const minCol = Math.min(...shape.map(p => p[1]));

    return shape.map(p => [p[0] - minRow, p[1] - minCol]);
}

// 두 조각 패턴 비교
function shapesMatch(shape1, shape2) {
    if (shape1.length !== shape2.length) return false;

    // 좌표를 문자열로 변환해서 집합 비교
    const set1 = new Set(shape1.map(p => `${p[0]},${p[1]}`));
    const set2 = new Set(shape2.map(p => `${p[0]},${p[1]}`));

    if (set1.size !== set2.size) return false;

    for (const coord of set1) {
        if (!set2.has(coord)) return false;
    }

    return true;
}

// 추출한 패턴으로 조각 이름 찾기
function findPieceNameByShape(extractedShape) {
    if (!extractedShape || extractedShape.length === 0) {
        console.warn('⚠️ Empty shape extracted');
        return null;
    }

    // PIECES 객체에서 매칭되는 조각 찾기
    for (const [pieceName, pieceData] of Object.entries(PIECES)) {
        const pieceShape = normalizeShape(pieceData.shape);

        if (shapesMatch(extractedShape, pieceShape)) {
            console.log(`✓ Matched shape to ${pieceName}`);
            return pieceName;
        }
    }

    console.warn(`⚠️ No matching piece found for shape:`, extractedShape);
    return null;
}
    function fillPiecesFromCV(pieceData) {
        clearPieces();

        let successCount = 0;

        pieceData.forEach((data, index) => {
            const { pieceName, grade, count } = data;
            const countInput = document.getElementById(`piece-count-${pieceName}-${grade}`);

            if (countInput) {
                // 기존 값에 추가
                const currentValue = parseInt(countInput.value) || 0;
                countInput.value = currentValue + count;
                console.log(`✓ Set piece-count-${pieceName}-${grade} = ${count}`);
                successCount++;
            } else {
                console.warn(`✗ Could not find input: piece-count-${pieceName}-${grade}`);
            }
        });

        console.log(`Successfully filled ${successCount}/${pieceData.length} pieces`);
    }

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
