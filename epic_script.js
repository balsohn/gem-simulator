// 게임 상태
let gameState = {
    currentPosition: 0,
    remainingTurns: 7,
    refineCount: 3,
    stabilizerCount: 3,
    gameOver: false,
    history: []
};

// 추천 타이머 ID
let recommendationTimer = null;

// 슬롯 정의 (0-16) - 에픽 보석 세공
const SLOTS = [
    { number: 0, grade: 'epic', label: '에픽' }, // Start
    { number: 1, grade: 'epic', label: '에픽' },
    { number: 2, grade: 'epic', label: '에픽' },
    { number: 3, grade: 'epic', label: '에픽' },
    { number: 4, grade: 'epic', label: '에픽' },
    { number: 5, grade: 'epic', label: '에픽' },
    { number: 6, grade: 'epic', label: '에픽' },
    { number: 7, grade: 'epic', label: '에픽' },
    { number: 8, grade: 'epic', label: '에픽' },
    { number: 9, grade: 'epic', label: '에픽' },
    { number: 10, grade: 'epic', label: '에픽' },
    { number: 11, grade: 'epic', label: '에픽' },
    { number: 12, grade: 'epic', label: '에픽' },
    { number: 13, grade: 'super-epic', label: '슈퍼 에픽' },
    { number: 14, grade: 'epic', label: '에픽' },
    { number: 15, grade: 'super-epic', label: '슈퍼 에픽' },
    { number: 16, grade: 'fail', label: '꽝' }
];

// 가공 방법 정의
const CRAFTING_METHODS = {
    hammer: { min: 3, max: 6, name: '세게 두드리기' },
    refine: { min: -3, max: 2, name: '세공하기' },
    stabilizer: { min: 0, max: 4, name: '안정제 사용' }
};

// 초기화
function initGame() {
    renderSlots();
    updateDisplay();
    addLog('게임이 시작되었습니다! 0번 칸에서 시작, 13번 또는 15번 칸(슈퍼 에픽)을 목표로 가공하세요!');
    showAutoRecommendation(); // 시작 시 추천 표시
}

// 슬롯 렌더링
function renderSlots() {
    const slotsDisplay = document.getElementById('slotsDisplay');
    slotsDisplay.innerHTML = '';

    SLOTS.forEach(slot => {
        // 0번 칸은 UI에 표시하지 않음
        if (slot.number === 0) return;

        const slotDiv = document.createElement('div');
        slotDiv.className = `slot ${slot.grade}`;
        if (slot.number === gameState.currentPosition) {
            slotDiv.classList.add('current');
        }
        slotDiv.innerHTML = `
            <div class="slot-number">${slot.number}</div>
            <div class="slot-label">${slot.label}</div>
        `;
        slotsDisplay.appendChild(slotDiv);
    });
}

// 디스플레이 업데이트
function updateDisplay() {
    document.getElementById('remainingTurns').textContent = gameState.remainingTurns;
    document.getElementById('currentPosition').textContent = gameState.currentPosition;
    document.getElementById('refineCount').textContent = gameState.refineCount;
    document.getElementById('stabilizerCount').textContent = gameState.stabilizerCount;

    const currentSlot = SLOTS[gameState.currentPosition];
    const gradeElement = document.getElementById('currentGrade');
    gradeElement.textContent = currentSlot.label;
    gradeElement.className = `value grade-${currentSlot.grade}`;

    const gemElement = document.getElementById('gemSprite');
    gemElement.className = `gem ${currentSlot.grade}-gem`;

    // 버튼 상태 업데이트
    document.getElementById('refine').disabled = gameState.refineCount === 0 || gameState.gameOver;
    document.getElementById('stabilizer').disabled = gameState.stabilizerCount === 0 || gameState.gameOver;
    document.getElementById('hammer').disabled = gameState.gameOver;

    renderSlots();
}

// 가공 실행
function craft(method) {
    if (gameState.gameOver) return;

    const craftMethod = CRAFTING_METHODS[method];
    const movement = getRandomInt(craftMethod.min, craftMethod.max);
    const newPosition = Math.max(1, Math.min(16, gameState.currentPosition + movement));

    // 애니메이션
    const gemElement = document.getElementById('gemSprite');
    gemElement.classList.add('crafting');
    setTimeout(() => gemElement.classList.remove('crafting'), 500);

    // 이동 숫자 이펙트 표시
    showMovementEffect(movement);

    // 상태 업데이트
    gameState.currentPosition = newPosition;
    gameState.remainingTurns--;

    if (method === 'refine') {
        gameState.refineCount--;
    } else if (method === 'stabilizer') {
        gameState.stabilizerCount--;
    }

    // 로그 추가
    const sign = movement >= 0 ? '+' : '';
    const slot = SLOTS[newPosition];
    addLog(`${craftMethod.name} 사용: ${sign}${movement} 이동 → ${newPosition}번 칸 (${slot.label})`);

    gameState.history.push({
        turn: 7 - gameState.remainingTurns + 1,
        method: craftMethod.name,
        movement: movement,
        position: newPosition,
        grade: slot.label
    });

    // 게임 종료 확인
    // 16번 꽝이면 즉시 종료, 15번은 계속 플레이 가능, 8회 다 쓰면 종료
    if (gameState.currentPosition === 16 || gameState.remainingTurns === 0) {
        endGame();
    } else {
        // 게임이 계속되면 다음 추천 표시
        showAutoRecommendation();
    }

    updateDisplay();
}

// 랜덤 정수 생성
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 로그 추가
function addLog(message) {
    const logDiv = document.getElementById('gameLog');
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.textContent = message;
    logDiv.insertBefore(logEntry, logDiv.firstChild);
}

// DP 계산 완료 알림
function showDPCompletionNotification(successProb) {
    const recommendDiv = document.getElementById('autoRecommendation');
    const contentDiv = document.getElementById('recommendationContent');

    // 이전 타이머 취소
    if (recommendationTimer) {
        clearTimeout(recommendationTimer);
        recommendationTimer = null;
    }

    contentDiv.textContent = `✅ 최적 전략 준비 완료! (성공률 ${successProb}%)`;
    recommendDiv.classList.remove('hidden');

    // 3초 후 일반 추천으로 전환
    recommendationTimer = setTimeout(() => {
        showAutoRecommendation();
    }, 3000);
}

// 자동 추천 표시 (DP 기반)
function showAutoRecommendation() {
    const recommendDiv = document.getElementById('autoRecommendation');
    const contentDiv = document.getElementById('recommendationContent');

    // 이전 타이머 취소
    if (recommendationTimer) {
        clearTimeout(recommendationTimer);
        recommendationTimer = null;
    }

    const currentPos = gameState.currentPosition;
    const remainingTurns = gameState.remainingTurns;
    let recommendation = '';

    // DP 테이블 사용 가능 여부 확인
    const useDP = typeof getOptimalAction === 'function' && dpTable !== null;

    if (useDP) {
        const optimal = getOptimalAction(
            currentPos,
            remainingTurns,
            gameState.refineCount,
            gameState.stabilizerCount
        );

        if (optimal && optimal.bestAction) {
            const actionName = getActionName(optimal.bestAction);
            const successProb = (optimal.successProb * 100).toFixed(1);

            if (currentPos === 15 || currentPos === 13) {
                recommendation = `🎉 슈퍼 에픽 달성! 최적 행동: ${actionName}`;
            } else if (currentPos === 16) {
                recommendation = '❌ 꽝 - 게임 종료';
            } else if (optimal.bestAction === 'none') {
                recommendation = '게임 종료';
            } else {
                recommendation = `🎯 최적: ${actionName} (성공률 ${successProb}%)`;
            }
        }
    } else if (typeof getOptimalAction === 'function') {
        // DP 함수는 있지만 테이블 계산 중
        recommendation = '⏳ 최적 전략 계산 중...';
    }

    // DP 사용 불가 또는 DP 결과 없으면 휴리스틱 사용
    if (!recommendation) {
        const distanceTo13 = 13 - currentPos;
        const distanceTo15 = 15 - currentPos;
        const distance = Math.min(Math.abs(distanceTo13), Math.abs(distanceTo15)); // Heuristic target
        const hasStabilizer = gameState.stabilizerCount > 0;
        const hasRefine = gameState.refineCount > 0;

        if (currentPos === 0) {
            recommendation = '세게 두드리기로 게임 시작! (+3~+6 이동)';
        } else if (currentPos === 13 || currentPos === 15) {
            recommendation = '🎉 슈퍼 에픽 달성! (16번 주의!)';
        } else if (currentPos > 15) {
            recommendation = '⚠️ 세공하기로 뒤로!';
        } else {
            recommendation = '세게 두드리기 또는 안정제로 13, 15번을 노리세요.';
        }
    }

    contentDiv.textContent = recommendation;
    recommendDiv.classList.remove('hidden');

    // 5초 후 자동으로 숨김
    recommendationTimer = setTimeout(() => {
        recommendDiv.classList.add('hidden');
        recommendationTimer = null;
    }, 5000);
}

// 이동 숫자 이펙트 표시
function showMovementEffect(movement) {
    const effectElement = document.getElementById('movementEffect');
    effectElement.className = 'movement-effect';
    const sign = movement > 0 ? '+' : '';
    effectElement.textContent = sign + movement;
    if (movement > 0) {
        effectElement.classList.add('positive');
    } else if (movement < 0) {
        effectElement.classList.add('negative');
    } else {
        effectElement.classList.add('zero');
    }
    effectElement.classList.add('show');
    setTimeout(() => {
        effectElement.classList.remove('show');
    }, 1500);
}

// 게임 종료
function endGame() {
    gameState.gameOver = true;
    const resultDiv = document.getElementById('gameResult');
    const titleElement = document.getElementById('resultTitle');
    const messageElement = document.getElementById('resultMessage');

    const finalSlot = SLOTS[gameState.currentPosition];

    if (finalSlot.grade === 'super-epic') {
        titleElement.textContent = '🎉 대성공! 슈퍼 에픽 달성!';
        titleElement.style.color = '#e74c3c';
        messageElement.textContent = `최고 등급인 슈퍼 에픽을 달성했습니다! (${7 - gameState.remainingTurns}번 시도)`;
    } else if (gameState.currentPosition === 16) {
        titleElement.textContent = '😢 아쉽게도 꽝입니다...';
        titleElement.style.color = '#95a5a6';
        messageElement.textContent = '16번 칸에 도달하여 랜덤 낮은 등급이 나왔습니다.';
    } else if (finalSlot.grade === 'epic') {
        titleElement.textContent = '👍 좋아요! 에픽 달성!';
        titleElement.style.color = '#9b59b6';
        messageElement.textContent = `에픽 등급을 달성했습니다! 현재 위치: ${gameState.currentPosition}번`;
    } else {
        titleElement.textContent = '🙂 희귀 등급 달성';
        titleElement.style.color = '#4a90e2';
        messageElement.textContent = `희귀 등급입니다. 현재 위치: ${gameState.currentPosition}번`;
    }

    resultDiv.classList.remove('hidden');
    addLog(`게임 종료! 최종 등급: ${finalSlot.label} (${gameState.currentPosition}번 칸)`);
}

// 게임 리셋
function resetGame() {
    gameState = {
        currentPosition: 0,
        remainingTurns: 7,
        refineCount: 7,
        stabilizerCount: 3,
        gameOver: false,
        history: []
    };

    document.getElementById('gameResult').classList.add('hidden');
    document.getElementById('gameLog').innerHTML = '';

    updateDisplay();
    addLog('게임이 리셋되었습니다. 새로운 가공을 시작하세요!');
    showAutoRecommendation(); // 리셋 시 추천 표시
}

// 몬테카를로 시뮬레이션 (10,000회)
function runSimulation() {
    const simulationCount = 10000;
    const results = {
        superEpic: 0,
        epic: 0,
        fail: 0,
        positions: {}
    };

    addLog('시뮬레이션 실행 중... (10,000회)');

    // 비동기로 실행하여 UI가 멈추지 않도록
    setTimeout(() => {
        for (let i = 0; i < simulationCount; i++) {
            const result = simulateRandomGame();
            const slot = SLOTS[result.finalPosition];

            if (slot.grade === 'super-epic') {
                results.superEpic++;
            } else if (result.finalPosition === 16) {
                results.fail++;
            } else if (slot.grade === 'epic') {
                results.epic++;
            }

            results.positions[result.finalPosition] = (results.positions[result.finalPosition] || 0) + 1;
        }

        displaySimulationResults(results, simulationCount);
        addLog('시뮬레이션 완료!');
    }, 100);
}

// 랜덤 게임 시뮬레이션
function simulateRandomGame() {
    let position = 0;
    let turns = 7;
    let refineLeft = 7;
    let stabilizerLeft = 3;

    while (turns > 0) {
        const availableMethods = ['hammer'];
        if (refineLeft > 0) availableMethods.push('refine');
        if (stabilizerLeft > 0) availableMethods.push('stabilizer');

        const method = availableMethods[Math.floor(Math.random() * availableMethods.length)];
        const craftMethod = CRAFTING_METHODS[method];
        const movement = getRandomInt(craftMethod.min, craftMethod.max);

        position = Math.max(1, Math.min(16, position + movement));
        turns--;

        if (method === 'refine') refineLeft--;
        if (method === 'stabilizer') stabilizerLeft--;

        if (position === 16) break;
    }

    return { finalPosition: position, turnsUsed: 7 - turns };
}

// 시뮬레이션 결과 표시
function displaySimulationResults(results, total) {
    const resultDiv = document.getElementById('simulationResult');

    const superEpicRate = (results.superEpic / total * 100).toFixed(2);
    const epicRate = (results.epic / total * 100).toFixed(2);
    const failRate = (results.fail / total * 100).toFixed(2);

    resultDiv.innerHTML = `
        <div class="stat-item">
            <span class="stat-label">🔴 슈퍼 에픽 (13, 15번):</span>
            <span class="stat-value" style="color: #e74c3c;">${results.superEpic}회 (${superEpicRate}%)</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">🟣 에픽:</span>
            <span class="stat-value" style="color: #9b59b6;">${results.epic}회 (${epicRate}%)</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">⚫ 꽝 (16번):</span>
            <span class="stat-value" style="color: #95a5a6;">${results.fail}회 (${failRate}%)</span>
        </div>
        <div style="margin-top: 15px; padding: 10px; background: white; border-radius: 5px;">
            <strong>💡 인사이트:</strong><br>
            무작위 선택으로는 슈퍼 에픽 달성률이 ${superEpicRate}%입니다.<br>
            전략적 접근으로 확률을 크게 높일 수 있습니다!
        </div>
    `;
}

// 수동 최적 행동 분석
function getManualRecommendation() {
    const manualResultDiv = document.getElementById('manualResult');
    manualResultDiv.innerHTML = ''; // Clear previous results

    const pos = parseInt(document.getElementById('manualPos').value);
    const turns = parseInt(document.getElementById('manualTurns').value);
    const refine = parseInt(document.getElementById('manualRefine').value);
    const stabilizer = parseInt(document.getElementById('manualStabilizer').value);

    // Basic validation
    if (isNaN(pos) || isNaN(turns) || isNaN(refine) || isNaN(stabilizer)) {
        manualResultDiv.innerHTML = '<p style="color: #e74c3c;">모든 값을 숫자로 입력해주세요.</p>';
        return;
    }
    if (pos < 0 || pos > 16 || turns < 0 || turns > 7 || refine < 0 || refine > 7 || stabilizer < 0 || stabilizer > 3) {
        manualResultDiv.innerHTML = '<p style="color: #e74c3c;">입력 값이 유효한 범위를 벗어났습니다.</p>';
        return;
    }

    if (typeof getOptimalAction !== 'function' || dpTable === null) {
        manualResultDiv.innerHTML = '<p style="color: #f39c12;">DP 테이블이 아직 계산되지 않았거나 로드되지 않았습니다. 잠시 후 다시 시도해주세요.</p>';
        return;
    }

    const optimal = getOptimalAction(pos, turns, refine, stabilizer);

    if (optimal && optimal.bestAction) {
        const actionName = getActionName(optimal.bestAction);
        const successProb = (optimal.successProb * 100).toFixed(1);

        let message = '';
        if (pos === 13 || pos === 15) {
            message = `🎉 현재 슈퍼 에픽 달성! 최적 행동: ${actionName}`;
        } else if (pos === 16) {
            message = '❌ 현재 꽝! 게임 종료 상태입니다.';
        } else if (optimal.bestAction === 'none') {
            message = '게임 종료 (더 이상 턴이 없거나 최적 행동이 없음)';
        } else {
            message = `🎯 최적 행동: <strong>${actionName}</strong> (슈퍼에픽 도달 성공률: ${successProb}%)`;
        }
        manualResultDiv.innerHTML = `<p>${message}</p>`;
    } else {
        manualResultDiv.innerHTML = '<p style="color: #95a5a6;">해당 상태에 대한 최적 행동을 찾을 수 없습니다.</p>';
    }
}

// 페이지 로드 시 초기화
window.addEventListener('DOMContentLoaded', initGame);
