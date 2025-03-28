/**
 * Gesture System Test Cases
 * Tests basic gesture detection and handling
 */

const tests = {
    // 1. Basic Touch Detection
    testSingleTouch: () => {
        const testCase = {
            name: 'Single Touch Detection',
            setup: () => {
                const el = document.createElement('div');
                el.setAttribute('gesture-detector', '');
                return el;
            },
            test: (el) => {
                // Simulate touch event
                const touchEvent = new TouchEvent('touchstart', {
                    touches: [{
                        clientX: 100,
                        clientY: 100
                    }]
                });
                el.dispatchEvent(touchEvent);
                
                // Check if touch was detected
                return el.components['gesture-detector'].internalState.startPosition !== null;
            },
            expected: true
        };
        return testCase;
    },

    // 2. Two-Finger Rotation
    testRotationGesture: () => {
        const testCase = {
            name: 'Rotation Gesture Detection',
            setup: () => {
                const el = document.createElement('div');
                el.setAttribute('gesture-detector', '');
                return el;
            },
            test: (el) => {
                let rotationDetected = false;
                el.addEventListener('gesture-rotate', () => {
                    rotationDetected = true;
                });

                // Simulate two-finger touch and move
                const touchStart = new TouchEvent('touchstart', {
                    touches: [
                        { clientX: 100, clientY: 100 },
                        { clientX: 200, clientY: 100 }
                    ]
                });
                const touchMove = new TouchEvent('touchmove', {
                    touches: [
                        { clientX: 100, clientY: 100 },
                        { clientX: 200, clientY: 200 }
                    ]
                });
                
                el.dispatchEvent(touchStart);
                el.dispatchEvent(touchMove);
                
                return rotationDetected;
            },
            expected: true
        };
        return testCase;
    },

    // 3. Pinch Scaling
    testPinchGesture: () => {
        const testCase = {
            name: 'Pinch Gesture Detection',
            setup: () => {
                const el = document.createElement('div');
                el.setAttribute('gesture-detector', '');
                return el;
            },
            test: (el) => {
                let pinchDetected = false;
                el.addEventListener('gesture-pinch', () => {
                    pinchDetected = true;
                });

                // Simulate pinch gesture
                const touchStart = new TouchEvent('touchstart', {
                    touches: [
                        { clientX: 100, clientY: 100 },
                        { clientX: 110, clientY: 110 }
                    ]
                });
                const touchMove = new TouchEvent('touchmove', {
                    touches: [
                        { clientX: 90, clientY: 90 },
                        { clientX: 120, clientY: 120 }
                    ]
                });
                
                el.dispatchEvent(touchStart);
                el.dispatchEvent(touchMove);
                
                return pinchDetected;
            },
            expected: true
        };
        return testCase;
    }
};

// Test Runner
const runTests = () => {
    console.group('Running Gesture System Tests');
    let passed = 0;
    let failed = 0;

    for (const [name, createTest] of Object.entries(tests)) {
        const testCase = createTest();
        console.group(`Test: ${testCase.name}`);
        
        try {
            const el = testCase.setup();
            const result = testCase.test(el);
            
            if (result === testCase.expected) {
                console.log('✅ PASSED');
                passed++;
            } else {
                console.error('❌ FAILED');
                console.error(`Expected: ${testCase.expected}, Got: ${result}`);
                failed++;
            }
        } catch (error) {
            console.error('❌ FAILED (Error)');
            console.error(error);
            failed++;
        }
        
        console.groupEnd();
    }

    console.groupEnd();
    console.log(`Results: ${passed} passed, ${failed} failed`);
    return { passed, failed };
};

// Export for use in test runner
if (typeof module !== 'undefined') {
    module.exports = { tests, runTests };
} 