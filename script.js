// 게임 상태
let gameState = {
    currentPosition: 0,
    remainingTurns: 8,
    refineCount: 3,
    stabilizerCount: 3,
    gameOver: false,
    history: []
};

// 추천 타이머 ID
let recommendationTimer = null;

// 슬롯 정의 (0-16)
const SLOTS = [
    { number: 0, grade: 'rare', label: '희귀' },
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
    { number: 13, grade: 'rare', label: '희귀' },
    { number: 14, grade: 'rare', label: '희귀' },
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
    addLog('게임이 시작되었습니다! 0번 칸에서 시작, 15번 칸(슈퍼 에픽)을 목표로 가공하세요!');
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
    updateButtonProbabilities();
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
        turn: 8 - gameState.remainingTurns,
        method: craftMethod.name,
        movement: movement,
        position: newPosition,
        grade: slot.label
    });

    // 게임 종료 확인
    // 16번 꽝이면 즉시 종료, 15번은 계속 플레이 가능, 8회 다 쓰면 종료
    if (gameState.currentPosition === 16 || gameState.remainingTurns === 0) {
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

// DP 계산 완료 알림
function showDPCompletionNotification(successProb) {
    // 추천 모달이 제거되어 더 이상 사용하지 않음
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

            if (currentPos === 15) {
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
        const distance = 15 - currentPos;
        const hasStabilizer = gameState.stabilizerCount > 0;
        const hasRefine = gameState.refineCount > 0;

    // 0번 칸 (시작)
    if (currentPos === 0) {
        recommendation = '세게 두드리기로 게임 시작! (+3~+6 이동)';
    }
    // 15번 도달 (목표)
    else if (currentPos === 15) {
        if (hasRefine) {
            recommendation = '🎉 슈퍼 에픽 달성! 세공하기로 15번 유지 가능 (16번 주의!)';
        } else {
            recommendation = '🎉 슈퍼 에픽 달성! 남은 턴 소진 (움직이면 16번 위험!)';
        }
    }
    // 15번 초과
    else if (currentPos > 15) {
        if (hasRefine) {
            recommendation = `⚠️ 세공하기로 뒤로! (세공 ${gameState.refineCount}회 남음, -3 필요)`;
        } else {
            recommendation = '❌ 세공 소진... 세게 두드리기로 운에 맡기기';
        }
    }
    // 거리별 세밀한 추천
    else {
        // 10번 이상 위치 (에픽 구간)에서 세공 추천
        const inEpicZone = currentPos >= 10 && currentPos < 15;

        // 초근접 (0-2칸)
        if (distance <= 2) {
            if (hasStabilizer) {
                recommendation = `🎯 안정제로 정확히! (${distance}칸, 안정제 ${gameState.stabilizerCount}회)`;
            } else if (hasRefine) {
                recommendation = `⚠️ 세공하기로 조정! (${distance}칸, 세공 ${gameState.refineCount}회)`;
            } else {
                recommendation = `⚠️ 안정제/세공 소진! 세게 두드리기로 도박 (${distance}칸)`;
            }
        }
        // 근접 (3-4칸)
        else if (distance <= 4) {
            // 10번 이상이면 세공 우선 추천
            if (inEpicZone && hasRefine) {
                recommendation = `🎨 세공하기 추천! (${currentPos}번→15번, 세공 ${gameState.refineCount}회, -3~+2로 안전 조정)`;
            } else if (hasStabilizer) {
                const stabNeeded = Math.ceil(distance / 2);
                if (gameState.stabilizerCount >= stabNeeded) {
                    recommendation = `안정제 ${stabNeeded}회로 착지! (안정제 ${gameState.stabilizerCount}회 남음)`;
                } else {
                    recommendation = `안정제 ${gameState.stabilizerCount}회 + 세게 두드리기 조합 (${distance}칸)`;
                }
            } else if (hasRefine) {
                recommendation = `⚠️ 세공하기로 조정! (${distance}칸, 세공 ${gameState.refineCount}회)`;
            } else {
                recommendation = `⚠️ 세게 두드리기 (안정제/세공 소진, ${distance}칸, 16번 초과 주의!)`;
            }
        }
        // 중거리 (5-6칸) - 10번 이상이면 세공 추천
        else if (distance <= 6) {
            if (inEpicZone && hasRefine) {
                recommendation = `🎨 세공하기로 안전하게! (${currentPos}번→15번, 세공 ${gameState.refineCount}회, 16번 초과 방지)`;
            } else {
                const hammerNeeded = Math.ceil(distance / 4.5);
                if (hasStabilizer && gameState.stabilizerCount >= 2) {
                    recommendation = `세게 ${hammerNeeded}회 + 안정제로 조정 (${distance}칸, 안정제 ${gameState.stabilizerCount}회)`;
                } else if (hasStabilizer) {
                    recommendation = `세게 두드리기 위주 + 안정제 1회 (${distance}칸, 안정제 ${gameState.stabilizerCount}회)`;
                } else if (hasRefine) {
                    recommendation = `⚠️ 세공하기로 신중히! (안정제 소진, ${distance}칸, 세공 ${gameState.refineCount}회)`;
                } else {
                    recommendation = `⚠️ 세게 두드리기만! (안정제/세공 소진, ${distance}칸, 약 ${hammerNeeded}회 필요)`;
                }
            }
        }
        // 중원거리 (7-8칸)
        else if (distance <= 8) {
            const hammerNeeded = Math.ceil(distance / 4.5);
            if (hasStabilizer && gameState.stabilizerCount >= 2) {
                recommendation = `세게 ${hammerNeeded}회 + 안정제로 조정 (${distance}칸, 안정제 ${gameState.stabilizerCount}회)`;
            } else if (hasStabilizer) {
                recommendation = `세게 두드리기 위주 + 안정제 1회 (${distance}칸, 안정제 ${gameState.stabilizerCount}회)`;
            } else {
                recommendation = `⚠️ 세게 두드리기만! (안정제 소진, ${distance}칸, 약 ${hammerNeeded}회 필요)`;
            }
        }
        // 원거리 (9+칸)
        else {
            const hammerNeeded = Math.ceil(distance / 4.5);
            const turnsNeeded = hammerNeeded;
            if (turnsNeeded > remainingTurns) {
                recommendation = `🚨 턴 부족! 세게 ${remainingTurns}회로 최대한 접근 (${distance}칸)`;
            } else {
                recommendation = `세게 두드리기로 돌진! (${distance}칸, 약 ${hammerNeeded}회 필요)`;
            }
        }

        // 자원 부족 경고 추가
        if (!hasStabilizer && !hasRefine && distance > 0 && distance !== 15) {
            recommendation += ' 🚨 세공/안정제 모두 소진!';
        }
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

    // 이전 클래스 제거
    effectElement.className = 'movement-effect';

    // 숫자 표시
    const sign = movement > 0 ? '+' : '';
    effectElement.textContent = sign + movement;

    // 색상 클래스 추가
    if (movement > 0) {
        effectElement.classList.add('positive');
    } else if (movement < 0) {
        effectElement.classList.add('negative');
    } else {
        effectElement.classList.add('zero');
    }

    // 애니메이션 시작
    effectElement.classList.add('show');

    // 1.5초 후 클래스 제거 (애니메이션 종료)
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

    if (gameState.currentPosition === 15) {
        titleElement.textContent = '🎉 대성공! 슈퍼 에픽 달성!';
        titleElement.style.color = '#e74c3c';
        messageElement.textContent = `최고 등급인 슈퍼 에픽을 달성했습니다! (${8 - gameState.remainingTurns}번 시도)`;
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
            const slot = SLOTS[result.finalPosition];

            if (result.finalPosition === 15) {
                results.superEpic++;
            } else if (result.finalPosition === 16) {
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
    let position = 0;
    let turns = 8;
    let refineLeft = 3;
    let stabilizerLeft = 3;

    while (turns > 0) {
        // 랜덤 전략: 무작위 방법 선택
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

        // 16번 꽝이면 즉시 종료
        if (position === 16) break;
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
            <span class="stat-label">🔴 슈퍼 에픽 (15번):</span>
            <span class="stat-value" style="color: #e74c3c;">${results.superEpic}회 (${superEpicRate}%)</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">🟣 에픽 (10-12번):</span>
            <span class="stat-value" style="color: #9b59b6;">${results.epic}회 (${epicRate}%)</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">🔵 희귀:</span>
            <span class="stat-value" style="color: #4a90e2;">${results.rare}회 (${rareRate}%)</span>
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
    if (pos < 0 || pos > 16 || turns < 0 || turns > 8 || refine < 0 || refine > 3 || stabilizer < 0 || stabilizer > 3) {
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
        if (pos === 15) {
            message = `🎉 현재 슈퍼 에픽 달성! 최적 행동: ${actionName}`;
        } else if (pos === 16) {
            message = '❌ 현재 꽝! 게임 종료 상태입니다.';
        } else if (optimal.bestAction === 'none') {
            message = '게임 종료 (더 이상 턴이 없거나 최적 행동이 없음)';
        } else {
            message = `🎯 최적 행동: <strong>${actionName}</strong> (15번 도달 성공률: ${successProb}%)`;
        }
        manualResultDiv.innerHTML = `<p>${message}</p>`;
    } else {
        manualResultDiv.innerHTML = '<p style="color: #95a5a6;">해당 상태에 대한 최적 행동을 찾을 수 없습니다.</p>';
    }
}

// 버튼 확률 업데이트
function updateButtonProbabilities() {
    if (gameState.gameOver || typeof evaluateAction !== 'function') {
        return;
    }

    const pos = gameState.currentPosition;
    const turns = gameState.remainingTurns;
    const refine = gameState.refineCount;
    const stabilizer = gameState.stabilizerCount;

    // 각 액션의 성공 확률 계산
    const hammerProb = evaluateAction(pos, turns, refine, stabilizer, 'hammer');
    const refineProb = refine > 0 ? evaluateAction(pos, turns, refine, stabilizer, 'refine') : 0;
    const stabilizerProb = stabilizer > 0 ? evaluateAction(pos, turns, refine, stabilizer, 'stabilizer') : 0;

    // 최고 확률 찾기
    const probabilities = [
        { action: 'hammer', prob: hammerProb },
        { action: 'refine', prob: refineProb, available: refine > 0 },
        { action: 'stabilizer', prob: stabilizerProb, available: stabilizer > 0 }
    ];
    const maxProb = Math.max(...probabilities.map(p => p.prob));

    // 버튼에 확률 표시 및 최고 확률 하이라이트
    const hammerBtn = document.getElementById('hammer');
    const refineBtn = document.getElementById('refine');
    const stabilizerBtn = document.getElementById('stabilizer');

    // 기존 best-action 클래스 제거
    [hammerBtn, refineBtn, stabilizerBtn].forEach(btn => btn.classList.remove('best-action'));

    // 확률 표시
    document.getElementById('hammerProb').textContent = `성공률: ${(hammerProb * 100).toFixed(1)}%`;
    document.getElementById('refineProb').textContent = refine > 0 ? `성공률: ${(refineProb * 100).toFixed(1)}%` : '';
    document.getElementById('stabilizerProb').textContent = stabilizer > 0 ? `성공률: ${(stabilizerProb * 100).toFixed(1)}%` : '';

    // 최고 확률 버튼에 하이라이트
    if (hammerProb === maxProb) hammerBtn.classList.add('best-action');
    if (refineProb === maxProb && refine > 0) refineBtn.classList.add('best-action');
    if (stabilizerProb === maxProb && stabilizer > 0) stabilizerBtn.classList.add('best-action');
}

// 현재 상태 최적 분석 업데이트
function updateCurrentAnalysis() {
    const analysisDiv = document.getElementById('currentAnalysis');

    if (gameState.gameOver) {
        analysisDiv.innerHTML = '<p style="color: #95a5a6;">게임이 종료되었습니다.</p>';
        return;
    }

    if (typeof getOptimalAction !== 'function' || dpTable === null) {
        analysisDiv.innerHTML = '<p style="color: #95a5a6;">⏳ 최적 전략 계산 중...</p>';
        return;
    }

    const optimal = getOptimalAction(
        gameState.currentPosition,
        gameState.remainingTurns,
        gameState.refineCount,
        gameState.stabilizerCount
    );

    if (optimal && optimal.bestAction) {
        const actionName = getActionName(optimal.bestAction);
        const successProb = (optimal.successProb * 100).toFixed(1);

        analysisDiv.innerHTML = `
            <div class="current-best-action">
                <div class="best-action-label">🎯 최적 행동</div>
                <div class="best-action-name">${actionName}</div>
                <div class="best-action-prob">성공률: ${successProb}%</div>
            </div>
        `;
    } else {
        analysisDiv.innerHTML = '<p style="color: #95a5a6;">최적 행동을 찾을 수 없습니다.</p>';
    }
}

// 페이지 로드 시 초기화
window.addEventListener('DOMContentLoaded', initGame);
