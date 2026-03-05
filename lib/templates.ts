import { TemplateDefinition } from "@/lib/types";

export const RUNDOWN_TEMPLATES: TemplateDefinition[] = [
  {
    id: "seminar",
    name: "Seminar Kampus",
    description: "Alur standar pembukaan sampai penutupan seminar.",
    items: [
      {
        start: "08:00",
        durationMinutes: 30,
        agenda: "Registrasi Peserta",
        pic: "Tim Registrasi",
        location: "Lobby Gedung",
        notes: "Siapkan meja registrasi dan name tag.",
      },
      {
        start: "08:30",
        durationMinutes: 15,
        agenda: "Pembukaan dan Sambutan",
        pic: "MC",
        location: "Aula Utama",
        notes: "Koordinasi dengan operator audio.",
      },
      {
        start: "08:45",
        durationMinutes: 90,
        agenda: "Sesi Materi Utama",
        pic: "Koordinator Acara",
        location: "Aula Utama",
        notes: "Sediakan timer untuk narasumber.",
      },
      {
        start: "10:15",
        durationMinutes: 30,
        agenda: "Diskusi dan Tanya Jawab",
        pic: "Moderator",
        location: "Aula Utama",
        notes: "Kumpulkan pertanyaan dari peserta.",
      },
    ],
  },
  {
    id: "rapat",
    name: "Rapat Internal",
    description: "Template rapat koordinasi organisasi.",
    items: [
      {
        start: "18:30",
        durationMinutes: 15,
        agenda: "Pembukaan dan Agenda",
        pic: "Ketua Rapat",
        location: "Ruang Sekretariat",
        notes: "Pastikan daftar hadir tersedia.",
      },
      {
        start: "18:45",
        durationMinutes: 60,
        agenda: "Pembahasan Program Kerja",
        pic: "Koordinator Divisi",
        location: "Ruang Sekretariat",
        notes: "Bahas progres tiap divisi.",
      },
      {
        start: "19:45",
        durationMinutes: 30,
        agenda: "Penetapan Tindak Lanjut",
        pic: "Sekretaris",
        location: "Ruang Sekretariat",
        notes: "Catat PIC dan deadline.",
      },
    ],
  },
  {
    id: "lomba",
    name: "Lomba Mahasiswa",
    description: "Template alur lomba skala kampus.",
    items: [
      {
        start: "07:30",
        durationMinutes: 45,
        agenda: "Briefing Panitia",
        pic: "Koordinator Lapangan",
        location: "Pos Panitia",
        notes: "Pembagian HT dan check lokasi.",
      },
      {
        start: "08:15",
        durationMinutes: 30,
        agenda: "Registrasi Peserta",
        pic: "Tim Registrasi",
        location: "Meja Registrasi",
        notes: "Validasi berkas peserta.",
      },
      {
        start: "08:45",
        durationMinutes: 120,
        agenda: "Babak Penyisihan",
        pic: "Juri",
        location: "Arena Lomba",
        notes: "Atur pergantian peserta.",
      },
      {
        start: "10:45",
        durationMinutes: 45,
        agenda: "Final dan Pengumuman",
        pic: "Ketua Pelaksana",
        location: "Panggung Utama",
        notes: "Siapkan dokumentasi penyerahan hadiah.",
      },
    ],
  },
];

