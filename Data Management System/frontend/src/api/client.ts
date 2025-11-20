import axios from "axios";

const DEFAULT_API_BASE = "http://127.0.0.1:8000/api";
const API_BASE = import.meta.env.VITE_API_BASE || DEFAULT_API_BASE;

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000
});

export type ListResponse<T> = {
  ok: boolean;
  data: {
    items: T[];
    total: number;
  };
  error?: string;
};

export type AuditLogItem = {
  uuid: string;
  action: string;
  detail: string;
  created_at: string;
};

export type NoteRankItem = {
  uuid: string;
  rank: number;
  title: string;
  nickname: string;
  publish_time: string;
  read_count: string;
  click_rate: string;
  pay_conversion_rate: string;
  gmv: string;
  fetch_date: string;
  created_at: string;
};

export type AccountRankItem = {
  uuid: string;
  rank: number;
  shop_name: string;
  fans_count: string;
  read_count: string;
  click_rate: string;
  pay_conversion_rate: string;
  gmv: string;
  fetch_date: string;
  created_at: string;
};

export type RankChangeItem = {
  key: string;
  title?: string;
  nickname?: string;
  shop_name?: string;
  current_rank: number;
  previous_rank?: number | null;
  rank_change?: number | null;
  current?: Record<string, string | null>;
  previous?: Record<string, string | null> | null;
};

export type RankChangeResponse = {
  items: RankChangeItem[];
  current_date: string | null;
  previous_date: string | null;
};
