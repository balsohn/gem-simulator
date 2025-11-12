// 게임 상태
let gameState = {
    currentPosition: 1,
    remainingTurns: 8,
    refineCount: 3,
    stabilizerCount: 3,
    gameOver: false,
    history: []
};

// 슬롯 정의 (1-17)
const SLOTS = [
    { number: 1, grade: 'rare', label: '희귀' },
    { number: 2, grade: 'rare', label: '희귀' },
    { number: 3, grade: 'rare', label: '희귀' },
    { number: 4, grade: 'rare', label: '희귀' },
    { number: 5, grade: 'rare', label: '희귀' },
    { number: 6, grade: 'rare', label: '희귀' },
    { number: 7, grade: 'rare', label: '희귀' },
    { number: 8, grade: 'rare', label: '희귀' },
    { number: 9, grade: 'rare', label: '희귀' },
    { number: 10, grade: 'epic', label: '에픽' },
    { number: 11, grade: 'epic', label: '에픽' },
    { number: 12, grade: 'epic', label: '에픽' },
    { number: 13, grade: 'epic', label: '에픽' },
    { number: 14, grade: 'rare', label: '희귀' },
    { number: 15, grade: 'rare', label: '희귀' },
    { number: 16, grade: 'super-epic', label: '슈퍼 에픽' },
    { number: 17, grade: 'fail', label: '꽝' }
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
    addLog('게임이 시작되었습니다! 16번 칸(슈퍼 에픽)을 목표로 가공을 시작하세요!');
}

// 슬롯 렌더링
function renderSlots() {
    const slotsDisplay = document.getElementById('slotsDisplay');
    slotsDisplay.innerHTML = '';

    SLOTS.forEach(slot => {
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

    const currentSlot = SLOTS[gameState.currentPosition - 1];
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
    const newPosition = Math.max(1, Math.min(17, gameState.currentPosition + movement));

    // 애니메이션
    const gemElement = document.getElementById('gemSprite');
    gemElement.classList.add('crafting');
    setTimeout(() => gemElement.classList.remove('crafting'), 500);

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
    const slot = SLOTS[newPosition - 1];
    addLog(`${craftMethod.name} 사용: ${sign}${movement} 이동 → ${newPosition}번 칸 (${slot.label})`);

    gameState.history.push({
        turn: 8 - gameState.remainingTurns,
        method: craftMethod.name,
        movement: movement,
        position: newPosition,
        grade: slot.label
    });

    // 게임 종료 확인
    if (gameState.remainingTurns === 0 || gameState.currentPosition === 16 || gameState.currentPosition === 17) {
        endGame();
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

// 게임 종료
function endGame() {
    gameState.gameOver = true;
    const resultDiv = document.getElementById('gameResult');
    const titleElement = document.getElementById('resultTitle');
    const messageElement = document.getElementById('resultMessage');

    const finalSlot = SLOTS[gameState.currentPosition - 1];

    if (gameState.currentPosition === 16) {
        titleElement.textContent = '🎉 대성공! 슈퍼 에픽 달성!';
        titleElement.style.color = '#e74c3c';
        messageElement.textContent = `최고 등급인 슈퍼 에픽을 달성했습니다! (${8 - gameState.remainingTurns}번 시도)`;
    } else if (gameState.currentPosition === 17) {
        titleElement.textContent = '😢 아쉽게도 꽝입니다...';
        titleElement.style.color = '#95a5a6';
        messageElement.textContent = '17번 칸에 도달하여 랜덤 낮은 등급이 나왔습니다.';
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
        currentPosition: 1,
        remainingTurns: 8,
        refineCount: 3,
        stabilizerCount: 3,
        gameOver: false,
        history: []
    };

    document.getElementById('gameResult').classList.add('hidden');
    document.getElementById('gameLog').innerHTML = '';

    updateDisplay();
    addLog('게임이 리셋되었습니다. 새로운 가공을 시작하세요!');
}

// 몬테카를로 시뮬레이션 (10,000회)
function runSimulation() {
    const simulationCount = 10000;
    const results = {
        superEpic: 0,
        epic: 0,
        rare: 0,
        fail: 0,
        positions: {}
    };

    addLog('시뮬레이션 실행 중... (10,000회)');

    // 비동기로 실행하여 UI가 멈추지 않도록
    setTimeout(() => {
        for (let i = 0; i < simulationCount; i++) {
            const result = simulateRandomGame();
            const slot = SLOTS[result.finalPosition - 1];

            if (result.finalPosition === 16) {
                results.superEpic++;
            } else if (result.finalPosition === 17) {
                results.fail++;
            } else if (slot.grade === 'epic') {
                results.epic++;
            } else {
                results.rare++;
            }

            results.positions[result.finalPosition] = (results.positions[result.finalPosition] || 0) + 1;
        }

        displaySimulationResults(results, simulationCount);
        addLog('시뮬레이션 완료!');
    }, 100);
}

// 랜덤 게임 시뮬레이션
function simulateRandomGame() {
    let position = 1;
    let turns = 8;
    let refineLeft = 3;
    let stabilizerLeft = 3;

    while (turns > 0 && position !== 16 && position !== 17) {
        // 랜덤 전략: 무작위 방법 선택
        const availableMethods = ['hammer'];
        if (refineLeft > 0) availableMethods.push('refine');
        if (stabilizerLeft > 0) availableMethods.push('stabilizer');

        const method = availableMethods[Math.floor(Math.random() * availableMethods.length)];
        const craftMethod = CRAFTING_METHODS[method];
        const movement = getRandomInt(craftMethod.min, craftMethod.max);

        position = Math.max(1, Math.min(17, position + movement));
        turns--;

        if (method === 'refine') refineLeft--;
        if (method === 'stabilizer') stabilizerLeft--;

        if (position === 16 || position === 17) break;
    }

    return { finalPosition: position, turnsUsed: 8 - turns };
}

// 시뮬레이션 결과 표시
function displaySimulationResults(results, total) {
    const resultDiv = document.getElementById('simulationResult');

    const superEpicRate = (results.superEpic / total * 100).toFixed(2);
    const epicRate = (results.epic / total * 100).toFixed(2);
    const rareRate = (results.rare / total * 100).toFixed(2);
    const failRate = (results.fail / total * 100).toFixed(2);

    resultDiv.innerHTML = `
        <div class="stat-item">
            <span class="stat-label">🔴 슈퍼 에픽 (16번):</span>
            <span class="stat-value" style="color: #e74c3c;">${results.superEpic}회 (${superEpicRate}%)</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">🟣 에픽 (10-13번):</span>
            <span class="stat-value" style="color: #9b59b6;">${results.epic}회 (${epicRate}%)</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">🔵 희귀:</span>
            <span class="stat-value" style="color: #4a90e2;">${results.rare}회 (${rareRate}%)</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">⚫ 꽝 (17번):</span>
            <span class="stat-value" style="color: #95a5a6;">${results.fail}회 (${failRate}%)</span>
        </div>
        <div style="margin-top: 15px; padding: 10px; background: white; border-radius: 5px;">
            <strong>💡 인사이트:</strong><br>
            무작위 선택으로는 슈퍼 에픽 달성률이 ${superEpicRate}%입니다.<br>
            전략적 접근으로 확률을 크게 높일 수 있습니다!
        </div>
    `;
}

// 최적 전략 추천
function recommendStrategy() {
    addLog('최적 전략 분석 중...');

    setTimeout(() => {
        const strategy = calculateOptimalStrategy();
        displayStrategy(strategy);
        addLog('전략 분석 완료!');
    }, 100);
}

// 최적 전략 계산
function calculateOptimalStrategy() {
    const currentPos = gameState.currentPosition;
    const target = 16;
    const distance = target - currentPos;

    const strategies = [];

    // 전략 1: 직진 전략 (세게 두드리기 위주)
    if (distance > 0) {
        const hammerTurns = Math.ceil(distance / 4.5); // 평균 +4.5
        if (hammerTurns <= gameState.remainingTurns) {
            strategies.push({
                name: '직진 전략',
                description: '세게 두드리기를 사용해 빠르게 16번 칸으로 이동',
                steps: [
                    `현재 위치: ${currentPos}번 → 목표: 16번 (거리: ${distance})`,
                    `세게 두드리기 ${hammerTurns}번 사용 (평균 +4.5 이동)`,
                    `예상 도착 지점: 14-17번 사이`,
                    `16번 근처 도달 시 안정제나 세공하기로 미세 조정`
                ],
                priority: distance > 10 ? 'high' : 'medium',
                successRate: distance <= 12 ? '70-80%' : '50-60%'
            });
        }
    }

    // 전략 2: 안정 전략 (안정제 위주)
    if (gameState.stabilizerCount > 0) {
        strategies.push({
            name: '안정 전략',
            description: '안정제를 사용해 안전하게 목표 지점으로 이동',
            steps: [
                `안정제 사용으로 +0~+4 범위의 안정적인 이동`,
                `예상 ${Math.ceil(distance / 2)}번의 안정제 사용`,
                `세게 두드리기와 조합하여 정확한 위치 확보`,
                `16번 초과 방지 가능`
            ],
            priority: distance <= 8 ? 'high' : 'low',
            successRate: '60-70%'
        });
    }

    // 전략 3: 정밀 조정 전략 (현재 위치가 목표 근처일 때)
    if (distance <= 5 && distance > 0) {
        strategies.push({
            name: '정밀 조정 전략',
            description: '목표에 가까우므로 세밀한 조정으로 정확히 16번에 착지',
            steps: [
                `현재 ${currentPos}번에서 16번까지 ${distance}칸 남음`,
                distance <= 4 ? `안정제 1회로 정확히 도달 가능` : `세게 두드리기 1회 사용`,
                `초과 시 세공하기의 -3~+2 범위로 조정`,
                `남은 턴: ${gameState.remainingTurns}회로 충분한 여유`
            ],
            priority: 'very-high',
            successRate: '80-90%'
        });
    }

    // 전략 4: 역산 전략 (너무 멀리 갔을 때)
    if (currentPos > 16) {
        strategies.push({
            name: '역산 전략',
            description: '16번을 초과했으므로 세공하기로 후퇴',
            steps: [
                `현재 ${currentPos}번 (16번 초과)`,
                `세공하기 사용하여 -3~+2 범위로 조정`,
                `-3이 나오면 ${currentPos - 3}번으로 이동`,
                `16번에 재착지 시도`
            ],
            priority: 'critical',
            successRate: gameState.refineCount > 0 ? '40-50%' : '10-20%'
        });
    }

    // 우선순위 정렬
    strategies.sort((a, b) => {
        const priorityOrder = { 'critical': 0, 'very-high': 1, 'high': 2, 'medium': 3, 'low': 4 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    return strategies;
}

// 전략 표시
function displayStrategy(strategies) {
    const strategyDiv = document.getElementById('strategyResult');

    if (strategies.length === 0) {
        strategyDiv.innerHTML = '<p>현재 상황에서 추천할 전략이 없습니다.</p>';
        return;
    }

    let html = '';

    strategies.forEach((strategy, index) => {
        const priorityColor = {
            'critical': '#e74c3c',
            'very-high': '#e67e22',
            'high': '#27ae60',
            'medium': '#3498db',
            'low': '#95a5a6'
        };

        html += `
            <div style="margin-bottom: 20px; padding: 15px; background: white; border-radius: 10px; border-left: 5px solid ${priorityColor[strategy.priority]};">
                <h4 style="margin-bottom: 10px; color: ${priorityColor[strategy.priority]};">
                    ${index + 1}. ${strategy.name} (성공률: ${strategy.successRate})
                </h4>
                <p style="margin-bottom: 10px; color: #555;">${strategy.description}</p>
                <div style="background: #f8f9fa; padding: 10px; border-radius: 5px;">
                    ${strategy.steps.map((step, i) => `
                        <div class="strategy-step" style="margin-bottom: 5px;">
                            <span class="step-number">${i + 1}.</span> ${step}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });

    strategyDiv.innerHTML = html;
}

// 페이지 로드 시 초기화
window.addEventListener('DOMContentLoaded', initGame);
