"use client";

import { useTransition, type TransitionStartFunction } from "react";

export function useAppTransition(): [boolean, TransitionStartFunction] {
  return useTransition();
}
