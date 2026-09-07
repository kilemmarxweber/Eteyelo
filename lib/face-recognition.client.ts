import { euclideanDistance } from "@/lib/face-descriptor";

const FACE_API_SRC =
  "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js";
const MODEL_URL =
  "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights";

type FaceApiNet = {
  loadFromUri: (uri: string) => Promise<unknown>;
};

type FaceApiTinyOptions = new (options: {
  inputSize: number;
  scoreThreshold: number;
}) => unknown;

type FaceApiDetection = {
  descriptor: Float32Array;
};

type FaceApiGlobal = {
  nets: {
    tinyFaceDetector: FaceApiNet;
    faceLandmark68Net: FaceApiNet;
    faceRecognitionNet: FaceApiNet;
  };
  TinyFaceDetectorOptions: FaceApiTinyOptions;
  detectSingleFace: (
    input: HTMLVideoElement,
    options: unknown,
  ) => {
    withFaceLandmarks: () => {
      withFaceDescriptor: () => Promise<FaceApiDetection | undefined>;
    };
  };
};

declare global {
  interface Window {
    faceapi?: FaceApiGlobal;
  }
}

let modelsReady: Promise<FaceApiGlobal> | null = null;

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (window.faceapi) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-face-api="true"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () =>
          reject(new Error("Impossible de charger la reconnaissance faciale.")),
        { once: true },
      );
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.faceApi = "true";
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Impossible de charger la reconnaissance faciale."));
    document.head.appendChild(script);
  });
}

export async function loadFaceApi(): Promise<FaceApiGlobal> {
  if (!modelsReady) {
    modelsReady = (async () => {
      await loadScript(FACE_API_SRC);
      const faceapi = window.faceapi;
      if (!faceapi) {
        throw new Error("Reconnaissance faciale indisponible.");
      }
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      return faceapi;
    })().catch((error) => {
      modelsReady = null;
      throw error;
    });
  }
  return modelsReady;
}

const CAMERA_CONSTRAINTS: MediaStreamConstraints[] = [
  {
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1920, min: 640 },
      height: { ideal: 1080, min: 480 },
    },
  },
  {
    audio: false,
    video: {
      facingMode: { ideal: "user" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  },
  { audio: false, video: true },
];

export async function openAttendanceCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera non disponible sur cet appareil.");
  }

  let lastError: unknown;
  for (const constraints of CAMERA_CONSTRAINTS) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Camera indisponible.");
}

export async function detectFaceDescriptor(
  video: HTMLVideoElement,
): Promise<number[] | null> {
  const faceapi = await loadFaceApi();
  const detection = await faceapi
    .detectSingleFace(
      video,
      new faceapi.TinyFaceDetectorOptions({
        inputSize: 320,
        scoreThreshold: 0.5,
      }),
    )
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection?.descriptor || detection.descriptor.length !== 128) {
    return null;
  }
  return Array.from(detection.descriptor);
}

export function isStableFaceSample(
  samples: number[][],
  maxDistance = 0.32,
): boolean {
  if (samples.length < 3) return false;
  const latest = samples[samples.length - 1];
  return samples
    .slice(-3)
    .every((sample) => euclideanDistance(sample, latest) <= maxDistance);
}

export function averageDescriptors(samples: number[][]): number[] {
  const size = samples[0]?.length ?? 0;
  const totals = new Array<number>(size).fill(0);
  for (const sample of samples) {
    for (let i = 0; i < size; i++) totals[i] += sample[i];
  }
  return totals.map((value) => value / samples.length);
}
