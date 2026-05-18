import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { setAudioModeAsync, useAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useKeepAwake } from 'expo-keep-awake';
import {
  Animated,
  Easing,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type ScreenState = 'SETUP' | 'TIMER';
type TimerPhase = 'WORK' | 'REST' | 'FINISHED';

type WorkoutConfig = {
  workTime: number;
  restTime: number;
  totalRounds: number;
};

const COLORS = {
  background: '#0A0A0A',
  card: '#1E1E1E',
  cardBorder: '#2A2A2A',
  muted: '#8D8D8D',
  text: '#F5F5F5',
  neon: '#CCFF00',
  cyan: '#00E5FF',
  orange: '#FF4D2E',
  control: '#2B2B2B',
};

const DEFAULT_CONFIG: WorkoutConfig = {
  workTime: 30,
  restTime: 10,
  totalRounds: 5,
};

const AUDIO_OPTIONS = { keepAudioSessionActive: true, updateInterval: 1000 };
const START_SOUND = require('./assets/audio/start.wav');
const WORK_SOUND = require('./assets/audio/work.wav');
const REST_SOUND = require('./assets/audio/rest.wav');
const FINISH_SOUND = require('./assets/audio/finish.wav');

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function replayCue(player: AudioPlayer) {
  player.seekTo(0).finally(() => player.play());
}

function useWorkoutCues() {
  const startPlayer = useAudioPlayer(START_SOUND, AUDIO_OPTIONS);
  const workPlayer = useAudioPlayer(WORK_SOUND, AUDIO_OPTIONS);
  const restPlayer = useAudioPlayer(REST_SOUND, AUDIO_OPTIONS);
  const finishPlayer = useAudioPlayer(FINISH_SOUND, AUDIO_OPTIONS);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
    });
  }, []);

  return useMemo(
    () => ({
      playStart: () => replayCue(startPlayer),
      playWork: () => replayCue(workPlayer),
      playRest: () => replayCue(restPlayer),
      playFinish: () => replayCue(finishPlayer),
    }),
    [finishPlayer, restPlayer, startPlayer, workPlayer],
  );
}

function useWorkoutTimer(config: WorkoutConfig, screenState: ScreenState) {
  const [phase, setPhase] = useState<TimerPhase>('WORK');
  const [timeLeft, setTimeLeft] = useState(config.workTime);
  const [currentRound, setCurrentRound] = useState(1);
  const [isPaused, setIsPaused] = useState(false);

  const startWorkout = useCallback(() => {
    setPhase('WORK');
    setTimeLeft(config.workTime);
    setCurrentRound(1);
    setIsPaused(false);
  }, [config.workTime]);

  const resetWorkout = useCallback(() => {
    setPhase('WORK');
    setTimeLeft(config.workTime);
    setCurrentRound(1);
    setIsPaused(false);
  }, [config.workTime]);

  const togglePause = useCallback(() => {
    if (phase !== 'FINISHED') {
      setIsPaused(previous => !previous);
    }
  }, [phase]);

  useEffect(() => {
    if (screenState !== 'TIMER' || isPaused || phase === 'FINISHED') {
      return;
    }

    const intervalId = setInterval(() => {
      setTimeLeft(previousTime => {
        if (previousTime > 1) {
          return previousTime - 1;
        }

        if (phase === 'WORK') {
          setPhase('REST');
          return config.restTime;
        }

        if (currentRound >= config.totalRounds) {
          setPhase('FINISHED');
          setIsPaused(true);
          return 0;
        }

        setCurrentRound(previousRound => previousRound + 1);
        setPhase('WORK');
        return config.workTime;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [
    config.restTime,
    config.totalRounds,
    config.workTime,
    currentRound,
    isPaused,
    phase,
    screenState,
  ]);

  return {
    phase,
    timeLeft,
    currentRound,
    isPaused,
    startWorkout,
    resetWorkout,
    togglePause,
  };
}

type StepperCardProps = {
  label: string;
  value: number;
  unit: string;
  accentColor: string;
  min: number;
  step: number;
  onChange: (value: number) => void;
};

function StepperCard({
  label,
  value,
  unit,
  accentColor,
  min,
  step,
  onChange,
}: StepperCardProps) {
  const entrance = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const decrement = () => onChange(Math.max(min, value - step));
  const increment = () => onChange(value + step);

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(pressScale, {
        toValue: 1.035,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(pressScale, {
        toValue: 1,
        duration: 140,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [pressScale, value]);

  return (
    <Animated.View
      style={[
        styles.stepperCard,
        {
          opacity: entrance,
          transform: [
            {
              translateY: entrance.interpolate({
                inputRange: [0, 1],
                outputRange: [24, 0],
              }),
            },
            { scale: pressScale },
          ],
        },
      ]}
    >
      <View>
        <Text style={styles.stepperLabel}>{label}</Text>
        <Text style={styles.stepperValue}>
          {value}
          <Text style={styles.stepperUnit}> {unit}</Text>
        </Text>
      </View>

      <View style={styles.stepperControls}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          onPress={decrement}
          style={styles.stepperButton}
        >
          <Text style={styles.stepperButtonText}>-</Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          onPress={increment}
          style={[styles.stepperButton, { borderColor: accentColor }]}
        >
          <Text style={[styles.stepperButtonText, { color: accentColor }]}>+</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

type SetupScreenProps = {
  config: WorkoutConfig;
  onConfigChange: (nextConfig: WorkoutConfig) => void;
  onStart: () => void;
};

function SetupScreen({ config, onConfigChange, onStart }: SetupScreenProps) {
  const glow = useRef(new Animated.Value(0)).current;
  const totalDuration = useMemo(
    () => (config.workTime + config.restTime) * config.totalRounds,
    [config.restTime, config.totalRounds, config.workTime],
  );

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [glow]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.setupGlow,
            {
              opacity: glow.interpolate({
                inputRange: [0, 1],
                outputRange: [0.18, 0.42],
              }),
              transform: [
                {
                  scale: glow.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.96, 1.08],
                  }),
                },
              ],
            },
          ]}
        />
        <View style={styles.header}>
          <Text style={styles.kicker}>CHRONOSFIT</Text>
          <Text style={styles.title}>Custom Workout Timer</Text>
        </View>

        <View style={styles.setupSummary}>
          <Text style={styles.summaryLabel}>TOTAL SESSION</Text>
          <Text style={styles.summaryValue}>{formatTime(totalDuration)}</Text>
        </View>

        <View style={styles.stepperStack}>
          <StepperCard
            label="WORK"
            value={config.workTime}
            unit="SEC"
            accentColor={COLORS.neon}
            min={5}
            step={5}
            onChange={workTime => onConfigChange({ ...config, workTime })}
          />
          <StepperCard
            label="REST"
            value={config.restTime}
            unit="SEC"
            accentColor={COLORS.cyan}
            min={5}
            step={5}
            onChange={restTime => onConfigChange({ ...config, restTime })}
          />
          <StepperCard
            label="ROUNDS"
            value={config.totalRounds}
            unit="SETS"
            accentColor={COLORS.neon}
            min={1}
            step={1}
            onChange={totalRounds => onConfigChange({ ...config, totalRounds })}
          />
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Start workout"
          activeOpacity={0.86}
          onPress={onStart}
          style={styles.startButton}
        >
          <Text style={styles.startButtonText}>START WORKOUT</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

type TimerScreenProps = {
  config: WorkoutConfig;
  phase: TimerPhase;
  timeLeft: number;
  currentRound: number;
  isPaused: boolean;
  onTogglePause: () => void;
  onQuit: () => void;
};

function TimerScreen({
  config,
  phase,
  timeLeft,
  currentRound,
  isPaused,
  onTogglePause,
  onQuit,
}: TimerScreenProps) {
  useKeepAwake('chronosfit-active-workout');

  const phasePulse = useRef(new Animated.Value(0)).current;
  const tickScale = useRef(new Animated.Value(1)).current;
  const phaseEntrance = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;
  const isResting = phase === 'REST';
  const isFinished = phase === 'FINISHED';
  const phaseColor = isFinished ? COLORS.cyan : isResting ? COLORS.orange : COLORS.neon;
  const phaseLabel = isFinished ? 'FINISHED' : phase;
  const phaseTotal = isResting ? config.restTime : config.workTime;
  const progress = isFinished ? 1 : Math.max(0, timeLeft / phaseTotal);
  const energyBars = useMemo(() => Array.from({ length: 14 }, (_, index) => index), []);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(phasePulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(phasePulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    if (!isPaused && !isFinished) {
      animation.start();
    }

    return () => animation.stop();
  }, [isFinished, isPaused, phasePulse]);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(tickScale, {
        toValue: 1.08,
        duration: 100,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(tickScale, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [tickScale, timeLeft]);

  useEffect(() => {
    phaseEntrance.setValue(0);
    Animated.timing(phaseEntrance, {
      toValue: 1,
      duration: 360,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();
  }, [phase, phaseEntrance]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.timerScreen}>
        <View pointerEvents="none" style={styles.energyBars}>
          {energyBars.map(index => (
            <Animated.View
              key={index}
              style={[
                styles.energyBar,
                {
                  backgroundColor: phaseColor,
                  opacity: phasePulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.08, index % 3 === 0 ? 0.42 : 0.24],
                  }),
                  transform: [
                    {
                      scaleY: phasePulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.22 + (index % 4) * 0.1, 0.85 - (index % 5) * 0.06],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>
        <View style={styles.timerTopBar}>
          <Text style={styles.kicker}>CHRONOSFIT</Text>
          <Text style={styles.roundText}>
            ROUND {Math.min(currentRound, config.totalRounds)} / {config.totalRounds}
          </Text>
        </View>

        <View style={styles.timerCenter}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.phaseHalo,
              {
                borderColor: phaseColor,
                opacity: phasePulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.14, 0.34],
                }),
                transform: [
                  {
                    scale: phasePulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.82, 1.12],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.Text
            style={[
              styles.phaseText,
              {
                color: phaseColor,
                opacity: phaseEntrance,
                transform: [
                  {
                    translateY: phaseEntrance.interpolate({
                      inputRange: [0, 1],
                      outputRange: [18, 0],
                    }),
                  },
                  {
                    scale: phaseEntrance.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.86, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {phaseLabel}
          </Animated.Text>
          <Animated.Text style={[styles.timerText, { transform: [{ scale: tickScale }] }]}>
            {formatTime(timeLeft)}
          </Animated.Text>
          <Text style={styles.timerSubText}>
            {isFinished ? 'SESSION COMPLETE' : isPaused ? 'PAUSED' : 'IN PROGRESS'}
          </Text>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  backgroundColor: phaseColor,
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.controlRow}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={isPaused ? 'Resume workout' : 'Pause workout'}
            disabled={isFinished}
            onPress={onTogglePause}
            style={[
              styles.controlButton,
              isFinished && styles.controlButtonDisabled,
            ]}
          >
            <Text style={styles.controlButtonText}>
              {isPaused && !isFinished ? 'RESUME' : 'PAUSE'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Quit workout"
            onPress={onQuit}
            style={[styles.controlButton, styles.quitButton]}
          >
            <Text style={[styles.controlButtonText, styles.quitButtonText]}>QUIT</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  const [screenState, setScreenState] = useState<ScreenState>('SETUP');
  const [config, setConfig] = useState<WorkoutConfig>(DEFAULT_CONFIG);
  const timer = useWorkoutTimer(config, screenState);
  const cues = useWorkoutCues();
  const lastPhaseRef = useRef<TimerPhase>(timer.phase);

  const startWorkout = () => {
    cues.playStart();
    timer.startWorkout();
    lastPhaseRef.current = 'WORK';
    setScreenState('TIMER');
  };

  const quitWorkout = () => {
    timer.resetWorkout();
    setScreenState('SETUP');
  };

  useEffect(() => {
    if (screenState !== 'TIMER') {
      lastPhaseRef.current = timer.phase;
      return;
    }

    if (lastPhaseRef.current === timer.phase) {
      return;
    }

    if (timer.phase === 'WORK') {
      cues.playWork();
    } else if (timer.phase === 'REST') {
      cues.playRest();
    } else {
      cues.playFinish();
    }

    lastPhaseRef.current = timer.phase;
  }, [cues, screenState, timer.phase]);

  return (
    <View style={styles.app}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      {screenState === 'SETUP' ? (
        <SetupScreen
          config={config}
          onConfigChange={setConfig}
          onStart={startWorkout}
        />
      ) : (
        <TimerScreen
          config={config}
          phase={timer.phase}
          timeLeft={timer.timeLeft}
          currentRound={timer.currentRound}
          isPaused={timer.isPaused}
          onTogglePause={timer.togglePause}
          onQuit={quitWorkout}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  screen: {
    flex: 1,
    paddingHorizontal: 22,
    paddingBottom: 24,
    paddingTop: 28,
  },
  setupGlow: {
    backgroundColor: COLORS.neon,
    borderRadius: 999,
    height: 260,
    position: 'absolute',
    right: -120,
    top: -100,
    width: 260,
  },
  header: {
    marginBottom: 28,
  },
  kicker: {
    color: COLORS.neon,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  title: {
    color: COLORS.text,
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 39,
    marginTop: 8,
  },
  setupSummary: {
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 18,
    paddingVertical: 26,
  },
  summaryLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
  },
  summaryValue: {
    color: COLORS.text,
    fontSize: 56,
    fontWeight: '900',
    marginTop: 6,
  },
  stepperStack: {
    flex: 1,
    gap: 14,
  },
  stepperCard: {
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 112,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  stepperLabel: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  stepperValue: {
    color: COLORS.text,
    fontSize: 42,
    fontWeight: '900',
    marginTop: 4,
  },
  stepperUnit: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: '900',
  },
  stepperControls: {
    flexDirection: 'row',
    gap: 10,
  },
  stepperButton: {
    alignItems: 'center',
    backgroundColor: COLORS.control,
    borderColor: COLORS.cardBorder,
    borderRadius: 18,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  stepperButtonText: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 32,
  },
  startButton: {
    alignItems: 'center',
    backgroundColor: COLORS.neon,
    borderRadius: 24,
    justifyContent: 'center',
    minHeight: 66,
    shadowColor: COLORS.neon,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 18,
  },
  startButtonText: {
    color: '#0E0E0E',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
  },
  timerScreen: {
    flex: 1,
    justifyContent: 'space-between',
    overflow: 'hidden',
    paddingHorizontal: 22,
    paddingBottom: 24,
    paddingTop: 28,
  },
  energyBars: {
    bottom: 126,
    flexDirection: 'row',
    gap: 7,
    height: 180,
    left: 22,
    opacity: 0.7,
    position: 'absolute',
    right: 22,
    zIndex: 0,
  },
  energyBar: {
    borderRadius: 999,
    flex: 1,
  },
  timerTopBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  roundText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  timerCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  phaseHalo: {
    borderRadius: 160,
    borderWidth: 2,
    height: 260,
    position: 'absolute',
    width: 260,
  },
  phaseText: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 0,
  },
  timerText: {
    color: COLORS.text,
    fontSize: 104,
    fontWeight: '900',
    marginTop: 8,
  },
  timerSubText: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 10,
  },
  progressTrack: {
    backgroundColor: '#171717',
    borderColor: COLORS.cardBorder,
    borderRadius: 999,
    borderWidth: 1,
    height: 12,
    marginTop: 26,
    overflow: 'hidden',
    width: '82%',
  },
  progressFill: {
    borderRadius: 999,
    height: '100%',
  },
  controlRow: {
    flexDirection: 'row',
    gap: 12,
    zIndex: 2,
  },
  controlButton: {
    alignItems: 'center',
    backgroundColor: COLORS.control,
    borderColor: COLORS.cardBorder,
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    minHeight: 62,
    justifyContent: 'center',
  },
  controlButtonDisabled: {
    opacity: 0.42,
  },
  controlButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  quitButton: {
    backgroundColor: '#241312',
    borderColor: '#5F241D',
  },
  quitButtonText: {
    color: COLORS.orange,
  },
});
