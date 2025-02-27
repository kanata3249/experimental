import React, { FC, useState, useEffect, useRef } from 'react'
import { makeStyles, createStyles, Theme } from '@material-ui/core/styles'
import { isAndroid } from 'react-device-detect'

import { Grid, Button, TextField, FormControlLabel, Checkbox } from '@material-ui/core'
import { VariableSizeGrid } from 'react-window'

import { servantClassNames } from '../../fgo/servants'
import { ClassScores, ClassScore } from '../../fgo/classscores'
import { InventoryStatus, itemNames, itemName2Id } from '../../fgo/inventory'

import { DialogProviderContext } from './DialogProvider'
import { FilterDefinition, FilterValues } from './FilterDialog'
import { saveFilter, loadFilter, saveUpdatePath, loadUpdatePath, saveModifyInventory, loadModifyInventory } from '../storage'

type Prop = {
  classscores: ClassScores
  onChange(classscores: ClassScores): void
  getInventoryStatus(): InventoryStatus
  setInventoryStatus(InventoryStatus): void
}

type TableColumnInfo = {
  label: string
  key: string
  align: "left" | "right" | "center"
  width: number
  span?: number
  editable?: boolean
  type?: "number" | "string" | "boolean"
  min?: number
  max?: number
  button?: boolean
  buttonLabel?: string
  step?: number
}

type TableData = {
  id: number
  index: number
  classId: number
  nodeName: string
  prevNodeName: string
  effectText: string
  effectValue: string
  reserved: boolean
  acquired: boolean
  itemIds: number[]
  itemNames: string[]
  itemAmounts: number[]
  sands: number
  qp: number
  torches: number[]
  pathSands: number
  pathAcquiredSands: number
  pathTorches: number[]
  pathAcquiredTorches: number[]
}

type TableSummary = {
  classscores: number
  reserved: number
  acquired: number
  sands: {
    all: number
    reserved: number
    acquired: number
  }
  effects: {
    [classid: number]: {
      [effect: string]: string
    }
  }
}

const classscoreServantClassNames = {
  ...servantClassNames,

  "7": "裁讐月盾",
  "9": "分降詐獣"
}

const columns : TableColumnInfo[] = [
  { label: 'id', key: 'id', align: "left", width: 80 },
  { label: 'クラス', key: 'classId', align: "left", width: 80 },
  { label: 'ノード名', key: 'nodeName', align: "left", width: 160 },
  { label: '効果', key: 'effectText', align: "left", width: 300},
  { label: '効果量', key: 'effectValue', align: "left", width: 120},
  { label: '素材', key: 'itemNames', align: "left", width: 200 },
  { label: '素材数', key: 'itemAmounts', align: "right", width: 80 },
  { label: '砂', key: 'sands', align: "right", width: 80 },
  { label: '残経路砂', key: 'pathSandsLeft', align: "right", width: 80 },
  { label: '残トーチ', key: 'pathTorchesLeft', align: "center", width: 80 },
  { label: '経路砂', key: 'pathSands', align: "right", width: 80 },
  { label: '経路トーチ', key: 'pathTorches', align: "center", width: 80 },
  { label: 'QP', key: 'qp', align: "right", width: 80 },
  { label: '解放予定', key: 'reserved', align: "center", width: 80, editable: true, type: "boolean" },
  { label: '解放済み', key: 'acquired', align: "center", width: 80, editable: true, type: "boolean" },
]

const touchesText = (toches : number[]) => {
  const marks = [ '新', '明', '極' ]
  return toches.map((v, index) => v ? marks[index] : '').join('')
}

const getTableData = (tableData: TableData, columnIndex: number, sort?: boolean) => {
  const key = columns[columnIndex].key
  const row = tableData

  switch (key) {
    case 'classId':
      if (sort) {
        return row.classId
      }
      return classscoreServantClassNames[row.classId]

    case 'itemNames':
      return row.itemNames.join(' / ')
    case 'itemAmounts':
      return row.itemAmounts.join(' / ')

    case 'pathSandsLeft':
      return row.pathSands - row.pathAcquiredSands
    case 'pathSands':
      return row.pathSands
    case 'pathTorchesLeft':
      return touchesText(row.pathTorches.map((v, index) => v - row.pathAcquiredTorches[index]))
    case 'pathTorches':
      return touchesText(row.pathTorches)
  
    default:
      return row[key]
  }
}

const updateInventory = (classscore: ClassScore, newState: boolean, inventoryStatus: InventoryStatus) => {
  const oldState = classscore.acquired
  const inc = !newState && oldState

  if (newState != oldState) {
    Object.entries(classscore.spec.items).forEach(([itemId, amount]) => {
      inventoryStatus[itemId].stock += (inc ? 1 : -1) * amount
    })
    return true
  }
  return false
}

const filterDefinition: FilterDefinition[] = [
  {
    name: "クラス", key: "class", type: "check",
    buttons: [
      { label: "セイバー", key: "剣" },
      { label: "アーチャー", key: "弓" },
      { label: "ランサー", key: "槍" },
      { label: "ライダー", key: "騎" },
      { label: "キャスター", key: "術" },
      { label: "アサシン", key: "殺" },
      { label: "バーサーカー", key: "狂" },
      { label: "EX1", key: "裁讐月盾" },
      { label: "EX2", key: "分降詐獣" },
    ]
  },
  {
    name: "効果", key: "effect", type: "check",
    buttons: [
      { label: "Busterカード威力", key: "Busterカード威力アップ" },
      { label: "Artsカード威力", key: "Artsカード威力アップ" },
      { label: "Quickカード威力", key: "Quickカード威力アップ" },
      { label: "EXアタック性能", key: "Extraアタック性能アップ" },
      { label: "Busterクリティカル威力", key: "Busterカードのクリティカル威力アップ" },
      { label: "Artsクリティカル威力", key: "Artsカードのクリティカル威力アップ" },
      { label: "Quickクリティカル威力", key: "Quickカードのクリティカル威力アップ" },
      { label: "宝具威力", key: "宝具威力アップ" },
      { label: "クリティカル威力", key: "クリティカル威力アップ" },
      { label: "スター発生率", key: "スター発生率アップ" },
      { label: "令呪時 攻撃力・防御力", key: "令呪使用時 攻撃力アップ(1T)\n防御力アップ(1T)" },
      { label: "効果なし", key: "" }
    ]
  },
  {
    name: "解放状態", key: "acquired", type: "check",
    buttons: [
      { label: "未解放", key: "notacquired" },
      { label: "解放済み", key: "acquired" },
    ]
  },
  {
    name: "解放予定", key: "reserved", type: "check",
    buttons: [
      { label: "予定なし", key: "notreserved" },
      { label: "解放予定", key: "reserved" },
    ]
  },
]
const defaultFilterValues: FilterValues = Object.values(filterDefinition).reduce((acc, group) => {
  acc[group.key] = group.buttons.reduce((acc, button) => {
      acc[button.key] = true
      return acc
    },{})
    return acc
  },{}
)

const validateFilter = (values: FilterValues): FilterValues => {
  return Object.values(filterDefinition).reduce((acc, group) => {
    acc[group.key] = group.buttons.reduce((acc, button) => {
      acc[button.key] = defaultFilterValues[group.key][button.key]
      if (values && values[group.key])
        acc[button.key] = values[group.key][button.key]
      return acc
    },{})
    return acc
  },{})
}

const useStyles = makeStyles((theme: Theme) => 
  createStyles({
    container: {
      height: "100%"
    },
    summary: {
      flexGrow: 1
    },
    controller: {
      width: "100%",
      minHeight: 48,
      paddingRight: 8,
      paddingLeft: 8
    },
    head: {
      padding: 4,
      paddingTop: 8
    },
    oddRowCell: {
      backgroundColor: theme.palette.action.hover,
      whiteSpace: "nowrap",
      scrollbarWidth: "none",
      overflow: "hidden",
      padding: 4
    },
    evenRowCell: {
      whiteSpace: "nowrap",
      scrollbarWidth: "none",
      overflow: "hidden",
      padding: 4
    },
  })
)

const calcTableData = (classscores: ClassScores): TableData[] => {
  const sortkey = (row) => row.id
  return classscores.map((classscore, index) => {
    const itemIds = Object.keys(classscore.spec.items).map((idStr) => Number(idStr))
    const itemTexts = itemIds.map<string>((id) => itemNames[id])
    const itemAmounts = Object.values(classscore.spec.items)
    if (itemIds.length >= 3) {
      itemIds.splice(-2, 2)
      itemTexts.splice(-2, 2)
      itemAmounts.splice(-2, 2)
    }
    return { id: classscore.id, index, classId: classscore.spec.class, nodeName: classscore.spec.nodeName, prevNodeName: classscore.spec.prevNodeName,
      effectText: `${classscore.spec.effect.condition} ${classscore.spec.effect.text}`.replace(/-\s*/g, ""), effectValue: classscore.spec.effect.value,
      reserved: classscore.reserved, acquired: classscore.acquired,
      itemIds: itemIds, itemNames: itemTexts, itemAmounts: itemAmounts,
      sands: classscore.spec.items[700], qp: classscore.spec.items[900],
      torches: [ classscore.spec.items[701] || 0, classscore.spec.items[702] || 0, classscore.spec.items[703] || 0 ],
      pathSands: 0, pathAcquiredSands: 0, pathTorches: [0, 0, 0], pathAcquiredTorches: [0, 0, 0]
    }
  }).map((row, index, array) => {
    if (row.prevNodeName.length) {
      const prevNode = array.find((v) => v.nodeName == row.prevNodeName)
      row.pathSands = prevNode.pathSands + (prevNode.sands || 0)
      row.pathAcquiredSands = prevNode.pathAcquiredSands + (prevNode.acquired ? (prevNode.sands || 0) : 0)
      row.pathTorches = prevNode.pathTorches.map((a, index) => a + prevNode.torches[index])
      row.pathAcquiredTorches = prevNode.pathAcquiredTorches.map((a, index) => a + (prevNode.acquired ? prevNode.torches[index] : 0))
    }
    return row
  }).sort((a, b) => {
    return sortkey(a) - sortkey(b)
  })
}

const addEffectValue = (a, b) => {
  const as = a?.split(/\n/) || [ "0%" ]
  const bs = b?.split(/\n/) || [ "0%" ]
  if (as[0] == '-') {
    return undefined
  }

  return as.map((av, index) => {
    return `${parseInt(av) + parseInt(bs[index])}%`
  }).join("\n")
}

const calcSummary = (classscores: ClassScores): TableSummary => {
  const sandItemid = itemName2Id['星光の砂']
  return classscores.reduce((acc, classscore) => {
    acc.classscores++
    acc.sands.all += classscore.spec.items[sandItemid] || 0
    if (classscore.reserved && !classscore.acquired) {
      acc.reserved++
      acc.sands.reserved += classscore.spec.items[sandItemid] || 0
    }
    if (classscore.acquired) {
      acc.acquired++
      acc.sands.acquired += classscore.spec.items[sandItemid] || 0
      const point = (Object.keys(classscore.spec.items).length > 1 ? 1 : 0) + (acc.effects[classscore.spec.class]?.point || 0)
      acc.effects[classscore.spec.class] = { ...acc.effects[classscore.spec.class],
        point,
         [classscore.spec.effect.text]: addEffectValue(acc.effects[classscore.spec.class]?.[classscore.spec.effect.text], classscore.spec.effect.value)
      }
    }
    return acc
  }, { classscores: 0, reserved: 0, acquired: 0, sands: { all: 0, reserved: 0, acquired: 0 }, effects: {} })
}

const filterAndSort = (tableData: TableData[], filters: FilterValues, sortColumn: number, sortOrder: number) => {
  return tableData.filter((row) => {
    return Object.entries(filters).every(([groupKey, groupValues]) => {
      switch(groupKey) {
        case "class":
          return Object.entries(groupValues).some(([filterKey, enabled]) => {
            return enabled && (classscoreServantClassNames[row.classId] == filterKey)
          })
        case "effect":
          return Object.entries(groupValues).some(([filterKey, enabled]) => {
            return enabled && (row.effectText == filterKey)
          })
        case "acquired":
          return Object.entries(groupValues).some(([filterKey, enabled]) => {
            switch (filterKey) {
            case 'notacquired':
              return enabled && !row.acquired
            case 'acquired':
              return enabled && row.acquired
            }
          })
        case "reserved":
          return Object.entries(groupValues).some(([filterKey, enabled]) => {
            switch (filterKey) {
            case 'notreserved':
              return enabled && !row.reserved
            case 'reserved':
              return enabled && row.reserved
            }
          })
        default:
          return false
      }
    })
  }).sort((a, b) => {
    let aValue = getTableData(a, sortColumn, true)
    let bValue = getTableData(b, sortColumn, true)

    if (aValue == bValue)
      return 0
    if (bValue > aValue)
      return -sortOrder
    else
      return sortOrder
  })
}

export const ClassScoreTable: FC<Prop> = (props) => {
  const classes = useStyles()
  const myRef = useRef<HTMLDivElement>()
  const headerRef = useRef<VariableSizeGrid>()
  const bodyRef = useRef<VariableSizeGrid>()
  const [ tableKey, setTableKey ] = useState(0)
  const [ sortBy, setSortBy ] = useState(0)
  const [ sortOrder, setSortOrder ] = useState(1)
  const [ filterValues, setFilterValues ] = useState<FilterValues>(validateFilter(loadFilter("ClassScoreTable")))
  const [ tableSize, setTableSize ] = useState([1000, 800])
  const tableData = filterAndSort(calcTableData(props.classscores), filterValues, sortBy, sortOrder)
  const summary = calcSummary(props.classscores)
  let updatePath = loadUpdatePath()
  let modifyInventory = loadModifyInventory('ClassScoreTable')
  const refs = {}

  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width
      const height = entries[0].contentRect.height
      if (!(isAndroid && document.activeElement.nodeName == 'INPUT')) {
        window.requestAnimationFrame((): void | undefined => {
          setTableSize([width, height])
        })
      }
    })

    myRef.current && resizeObserver.observe(myRef.current.parentElement)

    return (): void => {
      resizeObserver.disconnect();
    }
  }, [])

  const handleClickColumn = (column: number) => {
    if (sortBy == column) {
      setSortOrder(-sortOrder)
    } else {
      setSortOrder(-1)
      setSortBy(column)
    }
  }

  const focusNextTabStop = (rowIndex: number, columnIndex: number) => {
    for (let index = columnIndex + 1; index < columns.length; index++) {
      if (columns[index].editable) {
        const nextTabRef = refs[rowIndex + "-" + index]
        nextTabRef?.current?.focus()
        return
      }
    }
    for (let index = 0; index <= columnIndex; index++) {
      if (columns[index].editable) {
        const nextTabRef = refs[(rowIndex + 1) + "-" + index]
        nextTabRef?.current?.focus()
        return
      }
    }
  }

  const handleCloseFilter = (newFilterValues: FilterValues) => {
    setFilterValues(newFilterValues)
    saveFilter("ClassScoreTable", newFilterValues)
  }

  const getNodePath = (classScores: ClassScores, index: number) => {
    if (index < 0) {
      return []
    }
    const prevNodeIndex = classScores.findIndex((node) => node.spec.nodeName == classScores[index].spec.prevNodeName)
    const path = getNodePath(classScores, prevNodeIndex)
    if (prevNodeIndex >= 0) {
      path.push(classScores[prevNodeIndex])
    }
    return path
  }

  const filterRequiredNodes = (classScores: ClassScores, key: string, path: ClassScores) => {
    const nodeNotInPath = classScores.filter((node) => node[key] && !path.find((entry) => entry.nodeName == node.nodeName))
    const requiredNodeMap = nodeNotInPath.reduce((acc, node) => {
      acc[node.nodeName] = node
      const index = classScores.findIndex((entry) => entry.nodeName == node.nodeName)
      getNodePath(classScores, index).forEach((nodeInPath) => {
        acc[nodeInPath.nodeName] = nodeInPath
      })
      return acc
    },{})
    return path.filter((entry) => !requiredNodeMap[entry.nodeName])
  }

  const getDependedNodes = (classScores: ClassScores, entryNode: ClassScore) => {
    const dependedNodes = classScores.filter((entry) => entry.spec.prevNodeName == entryNode.spec.nodeName)
    return dependedNodes.reduce((acc, node) => {
      acc.push(...getDependedNodes(classScores, node))
      return acc
    },[...dependedNodes])
  }

  const handleCheckChanged = (rowIndex: number, columnIndex: number, checked: boolean) => {
    const key = columns[columnIndex].key
    const updateNodeList = [ props.classscores[tableData[rowIndex].index] ]
    const inventoryStatus = props.getInventoryStatus()

    if (updatePath) {
      if (checked) {
        updateNodeList.push( ...getNodePath(props.classscores, tableData[rowIndex].index) )
      } else {
        updateNodeList.push( ...getDependedNodes(props.classscores, props.classscores[tableData[rowIndex].index]))
      }
    }

    const inventoryUpdated = updateNodeList.reduce((acc, node) => {
      if (key == 'acquired' && modifyInventory) {
        acc = updateInventory(node, checked, inventoryStatus) || acc
      }
      node[key] = checked
      return acc
    }, false)

    if (inventoryUpdated) {
      props.setInventoryStatus(inventoryStatus)
    }
    props.onChange(props.classscores)
    setTableKey(tableKey + 1)
}

  const handleClickClipboard = (e: React.MouseEvent<HTMLButtonElement>) => {
    const lines: string[] = []

    lines.push(columns.reduce((acc, column) => (acc + "\t" + column.label),""))
    tableData.forEach((data) => {
      lines.push(columns.reduce((acc, column, columnIndex) => (acc + "\t\"" + getTableData(data, columnIndex)) + "\"",""))
    })

    navigator.clipboard?.writeText(lines.reduce((acc, line) => (acc + line.slice(1) + '\n'),""))
  }

  const handleClickRecalc = (e: React.MouseEvent<HTMLButtonElement>) => {
    setTableKey(tableKey + 1)
  }

  const handleUpdatePath = (e: React.ChangeEvent<HTMLInputElement>) => {
    updatePath = e.target.checked
    saveUpdatePath(updatePath)
  }

  const handleModifyInventory = (e: React.ChangeEvent<HTMLInputElement>) => {
    modifyInventory = e.target.checked
    saveModifyInventory('ClassScoreTable', modifyInventory)
  }

  const headerCell = ({columnIndex, rowIndex, style }) => {
    const column = columns[columnIndex]

    return (
      <div style={{...style, textAlign: column.align}} className={classes.head} onClick={() => handleClickColumn(columnIndex)}>
        {(sortBy == columnIndex) ? ((sortOrder == 1) ? column.label + "▲" : column.label + "▼") : column.label}
      </div>
    )
  }

  const editableCell = (columnIndex, rowIndex) => {
    const column = columns[columnIndex]
    const cellData = getTableData(tableData[rowIndex], columnIndex)
    const ref = useRef()

    refs[rowIndex + "-" + columnIndex] = ref
    if (column.type == "boolean") {
      if (cellData === null) {
      } else {
        return <Checkbox defaultChecked={cellData} size="small" inputRef={ref} color="default" disableRipple={true} style={{ padding: 0 }}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {handleCheckChanged(rowIndex, columnIndex, checked)}} />
      }
    }
  }

  const cell = ({columnIndex, rowIndex, style }) => {
    const column = columns[columnIndex]
    const cellData = getTableData(tableData[rowIndex], columnIndex)
    const [matchWord, charMain, charSub] = ((typeof(cellData) == 'string') && cellData.match(/^([^\s]+\s+[^\s]+)\s+(.*)$/)) || [ "", cellData, ""]

    return (
      <div style={{...style, textAlign: column.align}} className={rowIndex % 2 ? classes.oddRowCell : classes.evenRowCell}>
        {column.editable ?
          editableCell(columnIndex, rowIndex)
        : charSub ? <div>{charMain}<span style={{fontSize:"smaller"}}>&nbsp;{charSub}</span></div>
                : cellData
        }
      </div>
    )
  }
  const formatEffects = (effects) => {
    const labels = [
      { label: "令呪", key: "攻撃力アップ(1T)\n防御力アップ(1T)" },
      { label: "宝具", key: "宝具威力アップ" },
      { label: "EX性能", key: "Extraアタック性能アップ" },
      { label: "Q威力", key: "Quickカード威力アップ" },
      { label: "A威力", key: "Artsカード威力アップ" },
      { label: "B威力", key: "Busterカード威力アップ" },
      { label: "クリ", key: "クリティカル威力アップ" },
      { label: "Qクリ", key: "Quickカードのクリティカル威力アップ" },
      { label: "Aクリ", key: "Artsカードのクリティカル威力アップ" },
      { label: "Bクリ", key: "Busterカードのクリティカル威力アップ" },
      { label: "スター", key: "スター発生率アップ" },
      { label: "効果なし", key: "" }
    ]
    return labels.reduce((acc, label) => {
      if (effects[label.key]) {
        acc.push(`${label.label} ${effects[label.key]}`)
      }

      return acc
    }, []).join(' ')
  }
  
  return (
    <div className={classes.container} ref={myRef}>
      <Grid container className={classes.controller} justifyContent="flex-end" alignItems="center" spacing={1} >
        <Grid item className={classes.summary} >
          { `実装: ${summary.classscores}  強化予定: ${summary.reserved} 強化済み: ${summary.acquired} フィルタ: ${tableData.length} 砂: 実装 ${summary.sands.all} 予定 ${summary.sands.reserved} 済 ${summary.sands.acquired}`}
          { Object.entries(summary.effects).map(([classId, effects]) => {
            return <div key={`summary-${classId}`}>&emsp;{classscoreServantClassNames[parseInt(classId)]}: +{effects.point} {formatEffects(effects)}</div>
          }) }
        </Grid>
        <Grid item>
          <Button onClick={handleClickRecalc} variant="outlined" >再計算</Button>
        </Grid>
        <Grid item>
          <FormControlLabel control={<Checkbox name="checkedC" defaultChecked={updatePath} onChange={handleUpdatePath} />}
                            label="経路自動更新" />
        </Grid>
        <Grid item>
          <FormControlLabel control={<Checkbox name="checkedC" defaultChecked={modifyInventory} onChange={handleModifyInventory} />}
                            label="所持アイテム数に反映" />
        </Grid>
        <Grid item>
          <Button onClick={handleClickClipboard} variant="outlined" >CSVコピー</Button>
        </Grid>
        <Grid item>
          <DialogProviderContext.Consumer>
            {({showFilterDialog}) =>
              <Button onClick={() => showFilterDialog(filterValues, defaultFilterValues, filterDefinition, handleCloseFilter)}
              variant="contained"  color={Object.values(filterValues).some((group) => Object.values(group).some((value) => !value)) ? "secondary" : "default"} >
              フィルタ
            </Button>
          }
          </DialogProviderContext.Consumer>
        </Grid>
      </Grid>
      <VariableSizeGrid width={tableSize[0]} height={30} ref={headerRef}
        columnCount={columns.length} columnWidth={(columnIndex) => columns[columnIndex].width}
        rowCount={1} rowHeight={() => (30)} style={{overflowX: "hidden", overflowY: "scroll"}}>
        {headerCell}
      </VariableSizeGrid>
      <VariableSizeGrid width={tableSize[0]} height={tableSize[1] - (30 + 18 * Math.max(Object.keys(summary.effects).length, 1)) - 30} ref={bodyRef}
        columnCount={columns.length} columnWidth={(columnIndex) => columns[columnIndex].width}
        rowCount={tableData.length} rowHeight={() => (30)} onScroll={({scrollLeft}) => {headerRef.current.scrollTo({scrollLeft: scrollLeft, scrollTop: 0})}} >
        {cell}
      </VariableSizeGrid>
    </div>
  )
}