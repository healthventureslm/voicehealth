import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";

type Patient = Tables<"patients">;
type Ward = Tables<"wards">;

interface PatientSectorSelectorProps {
  patients: Patient[];
  wards: Ward[];
  selectedPatient: string;
  selectedWard: string;
  onPatientChange: (value: string) => void;
  onWardChange: (value: string) => void;
}

export function PatientSectorSelector({
  patients,
  wards,
  selectedPatient,
  selectedWard,
  onPatientChange,
  onWardChange,
}: PatientSectorSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Paciente & Setor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Selecione o paciente *</Label>
          <Select value={selectedPatient} onValueChange={onPatientChange}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha um paciente" />
            </SelectTrigger>
            <SelectContent>
              {patients.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name} {p.bed ? `• Leito ${p.bed}` : ""}{" "}
                  {p.medical_record ? `• ${p.medical_record}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Setor / Enfermaria</Label>
          <Select value={selectedWard} onValueChange={onWardChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o setor" />
            </SelectTrigger>
            <SelectContent>
              {wards.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
