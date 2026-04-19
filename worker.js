// [worker.js] v0.6.7 백그라운드 멀티스레딩 연산 엔진 (S열 상태 필터링 추가)

importScripts('https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js');

self.onmessage = function(e) {
    try {
        const { fileBuffer, branchArray, productObj } = e.data;
        const branchSet = new Set(branchArray); 

        const targetWb = XLSX.read(new Uint8Array(fileBuffer), { type: 'array' });
        const targetData = XLSX.utils.sheet_to_json(targetWb.Sheets[targetWb.SheetNames[0]], {header: 1});

        let parsedData = [];
        let resultData = [targetData[0]]; // 헤더 보존
        
        // 날짜 추출용 변수 초기화
        let minDate = "99999999";
        let maxDate = "00000000";

        for(let r = 1; r < targetData.length; r++) {
            const row = targetData[r];
            if(!row || !row[3]) continue; // D열(row[3]) 지점코드 기준 1차 필터링
            
            // 260408 추가 (with Gemini) S열(row[18]) 계약상태 필터링 (취소, 철회, 소멸 건 제외)
            const contractStatus = String(row[18] || "").trim();
            if(['취소', '청약철회', '지급(소멸)'].includes(contractStatus)) continue;
            
            const branchCode = String(row[3]).trim(); 
            
            if(branchSet.has(branchCode)) {
                resultData.push(row); 
                
                let rawDate = String(row[0] || "").replace(/[^\d]/g, "");
                
                // 최소/최대 날짜 갱신 로직
                if(rawDate && rawDate.length === 8) {
                    if(rawDate < minDate) minDate = rawDate;
                    if(rawDate > maxDate) maxDate = rawDate;
                }

                let prodName = String(row[21] || "").trim();
                
                parsedData.push({
                    rawDate: rawDate, 
                    mcp: Number(String(row[30] || "").replace(/[^\d\.-]/g, "")) || 0,
                    gName: productObj[prodName] || "기타",
                    
                    // 인덱스 정확한 매핑 적용 (B:1, C:2, D:3, E:4, F:5)
                    agtId: String(row[5] || "").trim(),
                    agtDisplay: `[${String(row[1] || "").trim()}] ${String(row[2] || "").trim()} - ${String(row[4] || "").trim()}`,
                    
                    yy: String(row[16] || "").replace(/[^\d]/g, ""),
                    gen: String(row[17] || "").trim(),
                    dxType: String(row[34] || "").trim(),
                    
                    // 대리점 3Depth 아코디언 매핑용 데이터
                    agencyName: String(row[1] || "").trim() || "기타대리점", // B열
                    branchName: String(row[2] || "").trim() || "기타지점",   // C열
                    branchCode: String(row[3] || "")                         // D열
                });
            }
        }

        self.postMessage({ 
            status: 'success', 
            parsedData: parsedData, 
            resultData: resultData,
            minDate: minDate === "99999999" ? "" : minDate,
            maxDate: maxDate === "00000000" ? "" : maxDate
        });

    } catch (error) {
        self.postMessage({ status: 'error', message: error.message });
    }
};