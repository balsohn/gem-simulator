// 동적 프로그래밍 기반 최적 전략 계산기

// DP 테이블
// dp[pos][turns][refine][stabilizer] = { bestAction, successProb, expectedValue }
let dpTable = null;

// DP 테이블 초기화 및 계산
function calculateDPTable() {
    console.log('📊 DP 테이블 계산 시작...');
    const startTime = performance.now();

    // 4차원 배열 초기화
    dpTable = {};

    // 역방향 DP: turns = 0부터 시작
    for (let pos = 0; pos <= 17; pos++) {
        dpTable[pos] = {};
        for (let turns = 0; turns <= 8; turns++) {
            dpTable[pos][turns] = {};
            for (let refine = 0; refine <= 3; refine++) {
                dpTable[pos][turns][refine] = {};
                for (let stabilizer = 0; stabilizer <= 3; stabilizer++) {
                    dpTable[pos][turns][refine][stabilizer] = {
                        bestAction: null,
                        successProb: 0,
                        expectedValue: 0
                    };
                }
            }
        }
    }

    // Base case: turns = 0
    for (let pos = 0; pos <= 17; pos++) {
        for (let refine = 0; refine <= 3; refine++) {
            for (let stabilizer = 0; stabilizer <= 3; stabilizer++) {
                dpTable[pos][0][refine][stabilizer] = {
                    bestAction: 'none',
                    successProb: pos === 16 ? 1.0 : 0.0,
                    expectedValue: pos === 16 ? 1.0 : 0.0
                };
            }
        }
    }

    // DP 계산: turns = 1부터 8까지
    for (let turns = 1; turns <= 8; turns++) {
        for (let pos = 0; pos <= 17; pos++) {
            // 17번(꽝)은 게임 종료
            if (pos === 17) {
                for (let refine = 0; refine <= 3; refine++) {
                    for (let stabilizer = 0; stabilizer <= 3; stabilizer++) {
                        dpTable[pos][turns][refine][stabilizer] = {
                            bestAction: 'fail',
                            successProb: 0.0,
                            expectedValue: 0.0
                        };
                    }
                }
                continue;
            }

            for (let refine = 0; refine <= 3; refine++) {
                for (let stabilizer = 0; stabilizer <= 3; stabilizer++) {
                    let bestAction = null;
                    let bestValue = -1;

                    // 1. 세게 두드리기 평가
                    const hammerValue = evaluateAction(pos, turns, refine, stabilizer, 'hammer');
                    if (hammerValue > bestValue) {
                        bestValue = hammerValue;
                        bestAction = 'hammer';
                    }

                    // 2. 세공하기 평가 (남아있을 때만)
                    if (refine > 0) {
                        const refineValue = evaluateAction(pos, turns, refine, stabilizer, 'refine');
                        if (refineValue > bestValue) {
                            bestValue = refineValue;
                            bestAction = 'refine';
                        }
                    }

                    // 3. 안정제 평가 (남아있을 때만)
                    if (stabilizer > 0) {
                        const stabilizerValue = evaluateAction(pos, turns, refine, stabilizer, 'stabilizer');
                        if (stabilizerValue > bestValue) {
                            bestValue = stabilizerValue;
                            bestAction = 'stabilizer';
                        }
                    }

                    dpTable[pos][turns][refine][stabilizer] = {
                        bestAction: bestAction,
                        successProb: bestValue,
                        expectedValue: bestValue
                    };
                }
            }
        }
    }

    const endTime = performance.now();
    const successProb = (dpTable[0][8][3][3].successProb * 100).toFixed(1);

    console.log(`✅ DP 테이블 계산 완료! (${(endTime - startTime).toFixed(0)}ms)`);
    console.log(`🎯 시작(0번, 8턴, 세공3, 안정제3) → 16번 성공 확률: ${successProb}%`);
    console.log(`📊 총 상태 수: ${18 * 9 * 4 * 4} = 2,592개`);

    // 사용자에게 알림
    if (typeof addLog === 'function') {
        addLog(`✅ 최적 전략 시스템 활성화! (성공률: ${successProb}%)`);
    }

    // 추천 배너 업데이트
    if (typeof showDPCompletionNotification === 'function') {
        showDPCompletionNotification(successProb);
    }
}

// 특정 행동의 기댓값 계산
function evaluateAction(pos, turns, refine, stabilizer, action) {
    const HAMMER = { min: 3, max: 6 };
    const REFINE = { min: -3, max: 2 };
    const STABILIZER = { min: 0, max: 4 };

    let expectedValue = 0;
    let range, newRefine, newStabilizer;

    switch (action) {
        case 'hammer':
            range = HAMMER;
            newRefine = refine;
            newStabilizer = stabilizer;
            break;
        case 'refine':
            range = REFINE;
            newRefine = refine - 1;
            newStabilizer = stabilizer;
            break;
        case 'stabilizer':
            range = STABILIZER;
            newRefine = refine;
            newStabilizer = stabilizer - 1;
            break;
    }

    const numOutcomes = range.max - range.min + 1;
    const prob = 1 / numOutcomes;

    for (let movement = range.min; movement <= range.max; movement++) {
        const newPos = Math.max(1, Math.min(17, pos + movement));

        // 17번 도달 시 즉시 실패
        if (newPos === 17) {
            expectedValue += prob * 0.0;
        } else {
            const futureValue = dpTable[newPos][turns - 1][newRefine][newStabilizer].successProb;
            expectedValue += prob * futureValue;
        }
    }

    return expectedValue;
}

// 최적 행동 조회
function getOptimalAction(pos, turns, refine, stabilizer) {
    if (!dpTable) {
        console.error('DP 테이블이 계산되지 않았습니다!');
        return null;
    }

    if (pos < 0 || pos > 17 || turns < 0 || turns > 8 || refine < 0 || refine > 3 || stabilizer < 0 || stabilizer > 3) {
        return null;
    }

    return dpTable[pos][turns][refine][stabilizer];
}

// 행동 이름을 한글로 변환
function getActionName(action) {
    const names = {
        'hammer': '세게 두드리기',
        'refine': '세공하기',
        'stabilizer': '안정제 사용',
        'none': '종료',
        'fail': '꽝'
    };
    return names[action] || action;
}

// 게임 시작 시 DP 테이블 계산
window.addEventListener('DOMContentLoaded', () => {
    // 약간의 지연 후 계산 시작 (UI가 먼저 로드되도록)
    setTimeout(() => {
        calculateDPTable();
    }, 100);
});
