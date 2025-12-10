import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { generateReport } from '../services/geminiService';
import { jsPDF } from 'jspdf';
import { FileText, Download, Loader2, Calendar } from 'lucide-react';

const Reports: React.FC = () => {
  const [reportType, setReportType] = useState('Monthly');
  const [tone, setTone] = useState('Manager-ready');
  const [selectedDateForWeek, setSelectedDateForWeek] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState('1');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportContent, setReportContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const today = new Date();
    setSelectedDateForWeek(today.toISOString().split('T')[0]);
    setSelectedMonth(today.toISOString().slice(0, 7));
    setSelectedQuarter(Math.floor((today.getMonth() + 3) / 3).toString());
  }, []);

  useEffect(() => {
    if (reportType === 'Weekly' && selectedDateForWeek) {
        const d = new Date(selectedDateForWeek);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
        const monday = new Date(d.setDate(diff));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        setStartDate(monday.toISOString().split('T')[0]);
        setEndDate(sunday.toISOString().split('T')[0]);
    } else if (reportType === 'Monthly' && selectedMonth) {
        const [y, m] = selectedMonth.split('-');
        const year = parseInt(y);
        const month = parseInt(m);
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);
        
        const fmt = (d: Date) => {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        };
        setStartDate(fmt(firstDay));
        setEndDate(fmt(lastDay));
    } else if (reportType === 'Quarterly') {
        const y = selectedYear;
        const q = parseInt(selectedQuarter);
        const startMonth = (q - 1) * 3;
        const endMonth = startMonth + 2;
        const firstDay = new Date(y, startMonth, 1);
        const lastDay = new Date(y, endMonth + 1, 0);
        const fmt = (d: Date) => {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        };
        setStartDate(fmt(firstDay));
        setEndDate(fmt(lastDay));
    }
  }, [reportType, selectedDateForWeek, selectedMonth, selectedYear, selectedQuarter]);

  const handleGenerate = async () => {
    if (!startDate || !endDate) return;
    setIsGenerating(true);
    
    // Async DB fetch
    const [goals, allAchievements, tasks] = await Promise.all([
        db.getGoals(),
        db.getAchievements(),
        db.getTasks()
    ]);
    
    const achievements = allAchievements.filter(a => 
      a.date >= startDate && a.date <= endDate
    );

    const result = await generateReport(startDate, endDate, goals, achievements, tasks, tone, reportType);
    setReportContent(result);
    setIsGenerating(false);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica");
    doc.setFontSize(18);
    doc.text(`${reportType} Report`, 20, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 20, 26);
    doc.text(`Period: ${startDate} to ${endDate}`, 20, 32);
    doc.setFontSize(12);
    doc.setTextColor(0);
    const splitText = doc.splitTextToSize(reportContent.replace(/#/g, ''), 170);
    doc.text(splitText, 20, 45);
    doc.save(`${reportType}_Report_${endDate}.pdf`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <h1 className="text-2xl font-bold text-gray-800">Performance Reports</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FileText size={20} className="text-primary" /> Report Settings
            </h2>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select value={reportType} onChange={e => setReportType(e.target.value)} className="w-full border rounded-md p-2 bg-gray-50 focus:ring-primary focus:border-primary">
                        <option>Weekly</option>
                        <option>Monthly</option>
                        <option>Quarterly</option>
                    </select>
                </div>
                {/* Date Pickers (Same as before) */}
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1"><Calendar size={12} /> Period Selection</label>
                    {reportType === 'Weekly' && (
                        <div><input type="date" value={selectedDateForWeek} onChange={e => setSelectedDateForWeek(e.target.value)} className="w-full border rounded-md p-2 bg-white text-sm" /></div>
                    )}
                    {reportType === 'Monthly' && (
                        <div><input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-full border rounded-md p-2 bg-white text-sm" /></div>
                    )}
                    {reportType === 'Quarterly' && (
                        <div className="flex gap-2">
                            <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="w-full border rounded-md p-2 bg-white text-sm">{[0, 1, 2, -1, -2].map(o => <option key={o} value={new Date().getFullYear() - o}>{new Date().getFullYear() - o}</option>)}</select>
                            <select value={selectedQuarter} onChange={e => setSelectedQuarter(e.target.value)} className="w-full border rounded-md p-2 bg-white text-sm"><option value="1">Q1</option><option value="2">Q2</option><option value="3">Q3</option><option value="4">Q4</option></select>
                        </div>
                    )}
                    <div className="mt-3 pt-3 border-t border-gray-200"><p className="text-xs text-gray-400">Range:</p><p className="text-xs font-semibold text-primary">{startDate} to {endDate}</p></div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
                    <select value={tone} onChange={e => setTone(e.target.value)} className="w-full border rounded-md p-2 bg-gray-50">
                        <option>Manager-ready</option>
                        <option>Casual</option>
                        <option>Concise</option>
                    </select>
                </div>

                <button onClick={handleGenerate} disabled={isGenerating || !startDate || !endDate} className="w-full bg-primary text-white py-2 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 flex justify-center items-center gap-2 shadow-sm">
                    {isGenerating ? <Loader2 className="animate-spin" size={18} /> : 'Generate Report'}
                </button>
            </div>
        </div>

        <div className="md:col-span-2 bg-white p-8 rounded-xl shadow-sm border border-gray-200 min-h-[500px] relative">
            {reportContent ? (
                <>
                    <div className="absolute top-4 right-4"><button onClick={handleExportPDF} className="flex items-center gap-2 text-sm text-primary hover:bg-blue-50 px-3 py-1.5 rounded transition-colors"><Download size={16} /> PDF</button></div>
                    <div className="prose prose-sm max-w-none prose-blue"><h2 className="text-xl font-bold text-gray-900 mb-2 border-b pb-2">{reportType} Report</h2><p className="text-xs text-gray-500 mb-6">Period: {startDate} - {endDate}</p><div className="whitespace-pre-wrap text-gray-700 leading-relaxed font-sans">{reportContent}</div></div>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400"><FileText size={48} className="mb-4 text-gray-200" /><p>Select settings and click generate.</p></div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Reports;