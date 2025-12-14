// Sound Effects Manager using Web Audio API
class SoundManager {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.masterVolume = 0.3;
    }

    // Create oscillator-based sound
    createSound(frequency, duration, type = 'sine', volumeMultiplier = 1) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(this.masterVolume * volumeMultiplier, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    // Dice roll sound
    diceRoll() {
        const notes = [200, 250, 300, 350, 400, 450, 500];
        notes.forEach((note, i) => {
            setTimeout(() => {
                this.createSound(note, 0.05, 'square', 0.3);
            }, i * 30);
        });
        
        setTimeout(() => {
            this.createSound(600, 0.2, 'sine', 0.4);
        }, 250);
    }

    // Property purchase sound
    propertyBuy() {
        [523.25, 659.25, 783.99].forEach((freq, i) => {
            setTimeout(() => {
                this.createSound(freq, 0.15, 'triangle', 0.5);
            }, i * 100);
        });
    }

    // Money received sound
    moneyReceived() {
        [659.25, 783.99, 987.77, 1318.51].forEach((freq, i) => {
            setTimeout(() => {
                this.createSound(freq, 0.1, 'sine', 0.4);
            }, i * 50);
        });
    }

    // Money paid/lost sound
    moneyPaid() {
        [523.25, 392.00, 293.66].forEach((freq, i) => {
            setTimeout(() => {
                this.createSound(freq, 0.15, 'sawtooth', 0.3);
            }, i * 100);
        });
    }

    // Turn changed sound
    turnChange() {
        this.createSound(880, 0.1, 'sine', 0.3);
        setTimeout(() => this.createSound(1047, 0.15, 'sine', 0.3), 100);
    }

    // Trade proposed sound
    tradeProposed() {
        [440, 554.37, 659.25].forEach((freq, i) => {
            setTimeout(() => {
                this.createSound(freq, 0.1, 'triangle', 0.4);
            }, i * 80);
        });
    }

    // Trade completed sound
    tradeCompleted() {
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            setTimeout(() => {
                this.createSound(freq, 0.12, 'sine', 0.5);
            }, i * 70);
        });
    }

    // Jail sound
    jailSound() {
        [200, 180, 160, 140, 120].forEach((freq, i) => {
            setTimeout(() => {
                this.createSound(freq, 0.2, 'sawtooth', 0.4);
            }, i * 100);
        });
    }

    // Button click sound
    buttonClick() {
        this.createSound(800, 0.05, 'square', 0.2);
    }

    // Error sound
    errorSound() {
        this.createSound(200, 0.3, 'sawtooth', 0.5);
        setTimeout(() => this.createSound(150, 0.3, 'sawtooth', 0.5), 150);
    }

    // Hover sound
    hoverSound() {
        this.createSound(1200, 0.03, 'sine', 0.1);
    }

    // Game start sound
    gameStart() {
        [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            setTimeout(() => {
                this.createSound(freq, 0.15, 'triangle', 0.4);
            }, i * 80);
        });
    }

    // Pass GO sound
    passGo() {
        [392.00, 523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            setTimeout(() => {
                this.createSound(freq, 0.12, 'sine', 0.5);
            }, i * 60);
        });
    }

    // Create complex tone with multiple frequencies
    createComplexTone(frequencies, duration, volumeMultiplier = 1) {
        frequencies.forEach(freq => {
            this.createSound(freq, duration, 'sine', volumeMultiplier * 0.3);
        });
    }
}

// Export for use in main game
window.soundManager = new SoundManager();
