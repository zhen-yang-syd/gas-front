import Papa from "papaparse";
import { CSVData, ParsedData } from "./types";

// CSV文件列表（按顺序读取）
export const CSV_FILES = ["/Data/TandFS.csv", "/Data/TandT.csv", "/Data/TandWD.csv"];

// 加载单个CSV文件
export async function loadCSVFile(filePath: string): Promise<CSVData> {
  const response = await fetch(filePath);
  const text = await response.text();

  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          console.warn("CSV parse errors:", results.errors);
        }

        const data = results.data as Array<Record<string, string>>;
        if (data.length === 0) {
          resolve({ headers: [], rows: [] });
          return;
        }

        // 获取所有列名
        const allHeaders = Object.keys(data[0]);

        // 识别时间列（第一列，可能是CreateTime、time、时间等）
        // const timeColumnName = allHeaders[0];

        // 传感器列（排除时间列）
        const sensorHeaders = allHeaders.slice(1);

        // 解析每一行数据
        const rows = data.map((row) => {
          const sensorRow: Record<string, string | null> = {};
          sensorHeaders.forEach((header) => {
            const value = row[header]?.trim();
            sensorRow[header] = value === "" || value === undefined ? null : value;
          });
          return sensorRow;
        });

        resolve({
          headers: sensorHeaders,
          rows,
        });
      },
      error: (error: Error) => {
        reject(error);
      },
    });
  });
}

// 加载所有CSV文件
export async function loadAllCSVFiles(): Promise<ParsedData> {
  const files: CSVData[] = [];
  const allSensorNamesSet = new Set<string>();
  let totalRows = 0;

  for (const filePath of CSV_FILES) {
    const csvData = await loadCSVFile(filePath);
    files.push(csvData);

    // 收集所有传感器名
    csvData.headers.forEach((name) => allSensorNamesSet.add(name));
    totalRows += csvData.rows.length;
  }

  return {
    files,
    allSensorNames: Array.from(allSensorNamesSet).sort(),
    totalRows,
  };
}
