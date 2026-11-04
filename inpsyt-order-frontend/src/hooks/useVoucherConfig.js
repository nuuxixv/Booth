import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { DEFAULT_VOUCHER_CONFIG, normalizeVoucherConfig } from '../utils/voucherConfig';

// site_settings.voucher_config 1회 조회 → 정규화 값. 고객(anon)·어드민 공용(site_settings는 전체 SELECT 허용).
// 조회 실패·컬럼 미적용이어도 기본값(바우처·1~5·만천백)으로 동작한다.
export function useVoucherConfig() {
  const [config, setConfig] = useState(() => normalizeVoucherConfig(DEFAULT_VOUCHER_CONFIG));

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('site_settings')
      .select('*')
      .single()
      .then(({ data }) => {
        if (!cancelled && data) setConfig(normalizeVoucherConfig(data.voucher_config));
      });
    return () => { cancelled = true; };
  }, []);

  return config;
}
