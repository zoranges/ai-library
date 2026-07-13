import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Select from '@/components/ui/Select';

interface Option {
  value: string;
  label: string;
}

interface FilterValues {
  country: string;
  state: string;
  district: string;
  schoolId: string;
}

interface CascadingFilterProps {
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  className?: string;
  /** Whether to show the school-level filter (default true) */
  showSchool?: boolean;
}

async function fetchOptions(url: string): Promise<Option[]> {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data || []).map((d: any) => ({ value: d.value, label: d.label }));
}

export default function CascadingFilter({ values, onChange, className, showSchool = true }: CascadingFilterProps) {
  const { t } = useTranslation();
  const [countries, setCountries] = useState<Option[]>([]);
  const [states, setStates] = useState<Option[]>([]);
  const [districts, setDistricts] = useState<Option[]>([]);
  const [schools, setSchools] = useState<Option[]>([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingSchools, setLoadingSchools] = useState(false);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valuesRef = useRef(values);
  valuesRef.current = values;

  const set = useCallback((patch: Partial<FilterValues>) => {
    onChangeRef.current({ ...valuesRef.current, ...patch });
  }, []);

  // Load countries on mount
  useEffect(() => {
    fetchOptions('/api/admin/locations/countries').then(setCountries);
  }, []);

  // Load states when country changes
  useEffect(() => {
    setStates([]);
    setDistricts([]);
    setSchools([]);
    if (!values.country) {
      fetchOptions('/api/admin/locations/states').then(setStates);
      return;
    }
    setLoadingStates(true);
    fetchOptions(`/api/admin/locations/states?country=${encodeURIComponent(values.country)}`)
      .then(setStates)
      .finally(() => setLoadingStates(false));
  }, [values.country]);

  // Load districts when state changes
  useEffect(() => {
    setDistricts([]);
    setSchools([]);
    if (!values.state) {
      if (values.country) return; // wait for state selection
      fetchOptions('/api/admin/locations/districts').then(setDistricts);
      return;
    }
    setLoadingDistricts(true);
    fetchOptions(`/api/admin/locations/districts?state=${encodeURIComponent(values.state)}`)
      .then(setDistricts)
      .finally(() => setLoadingDistricts(false));
  }, [values.state, values.country]);

  // Load schools when district changes
  useEffect(() => {
    if (!showSchool) return;
    setSchools([]);
    const params = new URLSearchParams();
    if (values.country) params.set('country', values.country);
    if (values.state) params.set('state', values.state);
    if (values.district) params.set('district', values.district);
    setLoadingSchools(true);
    fetchOptions(`/api/admin/locations/schools?${params.toString()}`)
      .then(setSchools)
      .finally(() => setLoadingSchools(false));
  }, [values.district, values.state, values.country, showSchool]);

  const countryOptions = [{ value: '', label: t('admin.allCountries') }, ...countries];
  const stateOptions = [{ value: '', label: t('admin.allStates') }, ...states];
  const districtOptions = [{ value: '', label: t('admin.allDistricts') }, ...districts];
  const schoolOptions = [{ value: '', label: t('admin.allSchools') }, ...schools];

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className || ''}`}>
      <div className="w-36">
        <Select
          options={countryOptions}
          value={values.country}
          onChange={(v) => set({ country: v, state: '', district: '', schoolId: '' })}
        />
      </div>
      <div className="w-36">
        <Select
          options={stateOptions}
          value={values.state}
          onChange={(v) => set({ state: v, district: '', schoolId: '' })}
        />
      </div>
      <div className="w-36">
        <Select
          options={districtOptions}
          value={values.district}
          onChange={(v) => set({ district: v, schoolId: '' })}
        />
      </div>
      {showSchool && (
        <div className="w-44">
          <Select
            options={schoolOptions}
            value={values.schoolId}
            onChange={(v) => set({ schoolId: v })}
          />
        </div>
      )}
    </div>
  );
}
