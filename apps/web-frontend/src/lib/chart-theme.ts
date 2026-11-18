'use client';

import { useTheme } from '@/components/theme/theme-provider';

export type ChartTheme = {
  surface: string;
  border: string;
  text: string;
  axis: string;
  axisLine: string;
  grid: string;
  cursor: string;
  cursorFill: string;
  series1: string;
  series2: string;
  series3: string;
  success: string;
  danger: string;
  warning: string;
  shadow: string;
};

const DARK: ChartTheme = {
  surface: '#0D1523',
  border: '#28354B',
  text: '#EDF4FE',
  axis: '#9FB0C6',
  axisLine: '#2A3950',
  grid: '#1E2A40',
  cursor: 'rgba(96, 165, 250, 0.28)',
  cursorFill: 'rgba(96, 165, 250, 0.08)',
  series1: '#60A5FA',
  series2: '#3B82F6',
  series3: '#22D3EE',
  success: '#2DD4BF',
  danger: '#FB7185',
  warning: '#FBBF24',
  shadow: 'rgba(0, 0, 0, 0.9)',
};

const LIGHT: ChartTheme = {
  surface: '#FFFFFF',
  border: '#C9DFED',
  text: '#101B2D',
  axis: '#54637A',
  axisLine: '#C9DFED',
  grid: '#DBEAF6',
  cursor: 'rgba(2, 132, 199, 0.35)',
  cursorFill: 'rgba(2, 132, 199, 0.08)',
  series1: '#0284C7',
  series2: '#0EA5E9',
  series3: '#0891B2',
  success: '#0E7490',
  danger: '#E11D48',
  warning: '#B45309',
  shadow: 'rgba(15, 42, 92, 0.18)',
};

export function useChartTheme(): ChartTheme {
  const { theme } = useTheme();
  return theme === 'light' ? LIGHT : DARK;
}
